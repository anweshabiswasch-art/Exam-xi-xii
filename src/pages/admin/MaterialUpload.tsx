import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, onSnapshot, orderBy, writeBatch, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  Box,
  Typography,
  Paper,
  Button,
  MenuItem,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { extractPdfText } from '../../utils/pdfTextExtraction';
import type { Topic, Material, MaterialType } from '../../types';

const ACCEPTED = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 25 * 1024 * 1024; // 25MB, matches storage.rules cap

function detectType(fileName: string): MaterialType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'docx';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  return 'note';
}

const TYPE_ICON: Record<MaterialType, JSX.Element> = {
  pdf: <PictureAsPdfIcon fontSize="small" />,
  docx: <DescriptionIcon fontSize="small" />,
  image: <ImageIcon fontSize="small" />,
  note: <DescriptionIcon fontSize="small" />,
};

export function MaterialUpload() {
  const { firebaseUser } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialClass, setMaterialClass] = useState<'XI' | 'XII'>('XI');
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'topics'), where('class', '==', materialClass));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Topic);
      setTopics(list);
      setTopicId(list[0]?.id ?? '');
    })();
  }, [materialClass]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Material));
    });
    return unsub;
  }, []);

  const handleUpload = () => {
    setError(null);
    setSuccess(false);
    if (!firebaseUser) return;
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (!title.trim()) {
      setError('Give the material a title.');
      return;
    }
    if (!topicId) {
      setError('Create a topic first, then choose it here.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is larger than 25MB. Compress it or split it into parts.');
      return;
    }

    const topic = topics.find((t) => t.id === topicId);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `materials/${materialClass}/${topicId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    setProgress(0);
    task.on(
      'state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        setError(err.message);
        setProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(storageRef);
        const materialType = detectType(file.name);
        const materialDoc = await addDoc(collection(db, 'materials'), {
          class: materialClass,
          topicId,
          chapter: topic?.chapter ?? '',
          title: title.trim(),
          type: materialType,
          storagePath,
          downloadURL,
          fileSizeBytes: file.size,
          uploadedBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });

        setProgress(null);
        setSuccess(true);
        setFile(null);
        setTitle('');

        // Index the PDF's text so students can search inside it. This runs
        // client-side (no server round-trip) and is best-effort: a scanned
        // image-only PDF will index as empty text, which is a real
        // limitation (no OCR here) rather than a failure to surface as an error.
        if (materialType === 'pdf') {
          setIndexingStatus('Indexing for search…');
          try {
            const { pages, truncated } = await extractPdfText(file, (done, total) =>
              setIndexingStatus(`Indexing for search… page ${done}/${total}`)
            );

            let batch = writeBatch(db);
            let opsInBatch = 0;
            for (const page of pages) {
              if (!page.text) continue; // skip blank pages, no point storing them
              batch.set(doc(db, 'materials', materialDoc.id, 'pages', String(page.pageNumber)), {
                pageNumber: page.pageNumber,
                text: page.text.slice(0, 5000), // keep each page doc well under Firestore's size limit
              });
              opsInBatch += 1;
              if (opsInBatch >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                opsInBatch = 0;
              }
            }
            await batch.commit();

            await updateDoc(doc(db, 'materials', materialDoc.id), {
              textIndexed: true,
              indexedPageCount: pages.length,
              textIndexTruncated: truncated,
            });
          } catch (err) {
            // Non-fatal: the file itself uploaded fine, only search indexing failed.
            console.error('PDF text indexing failed', err);
          } finally {
            setIndexingStatus(null);
          }
        }
      }
    );
  };

  const handleDelete = async (material: Material) => {
    if (!confirm(`Delete "${material.title}"? This removes the file permanently.`)) return;
    await deleteObject(ref(storage, material.storagePath)).catch(() => {
      // File may already be gone from storage; still clean up the Firestore doc.
    });
    if (material.textIndexed) {
      const pagesSnap = await getDocs(collection(db, 'materials', material.id, 'pages'));
      const batch = writeBatch(db);
      pagesSnap.docs.forEach((p) => batch.delete(p.ref));
      await batch.commit().catch(() => {});
    }
    await deleteDoc(doc(db, 'materials', material.id));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Materials</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Upload PDFs, Word docs, images, or notes for a topic. Students can read them online or download.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Upload a file</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Uploaded successfully.</Alert>}

        <ToggleButtonGroup exclusive value={materialClass} onChange={(_, v) => v && setMaterialClass(v)} sx={{ mb: 2 }}>
          <ToggleButton value="XI">Class XI</ToggleButton>
          <ToggleButton value="XII">Class XII</ToggleButton>
        </ToggleButtonGroup>

        <TextField select label="Topic / chapter" value={topicId} onChange={(e) => setTopicId(e.target.value)} fullWidth sx={{ mb: 2 }}>
          {topics.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.chapter} — {t.title}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="Title (shown to students)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />

        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mb: 2 }}>
          {file ? file.name : 'Choose file'}
          <input type="file" hidden accept={ACCEPTED} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Button>

        {progress !== null && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2, height: 8, borderRadius: 4 }} />}
        {indexingStatus && (
          <Alert severity="info" sx={{ mb: 2 }}>{indexingStatus}</Alert>
        )}

        <Box>
          <Button variant="contained" onClick={handleUpload} disabled={progress !== null || indexingStatus !== null}>
            {progress !== null ? `Uploading… ${progress}%` : 'Upload'}
          </Button>
        </Box>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>All materials ({materials.length})</Typography>
      <Paper variant="outlined">
        <List>
          {materials.map((m) => (
            <ListItem
              key={m.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDelete(m)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {TYPE_ICON[m.type]} {m.title}
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip size="small" label={`Class ${m.class}`} />
                    <Chip size="small" label={m.chapter} />
                    <Chip size="small" label={`${(m.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`} />
                    {m.textIndexed && (
                      <Chip size="small" color="success" label={`Searchable (${m.indexedPageCount ?? 0} pages)`} />
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
          {materials.length === 0 && (
            <ListItem>
              <ListItemText primary="No materials uploaded yet." />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}
