import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Stack,
  Tabs,
  Tab,
  Button,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import type { Material, MaterialType } from '../types';
import { ReaderDialog } from '../components/ReaderDialog';

const TYPE_ICON: Record<MaterialType, JSX.Element> = {
  pdf: <PictureAsPdfIcon />,
  docx: <DescriptionIcon />,
  image: <ImageIcon />,
  note: <DescriptionIcon />,
};

interface DeepSearchResult {
  material: Material;
  pageNumber: number;
  snippet: string;
}

function buildSnippet(text: string, term: string): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text.slice(0, 140);
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + term.length + 90);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function MaterialsLibrary() {
  const { appUser, firebaseUser } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'bookmarked'>('all');
  const [reading, setReading] = useState<Material | null>(null);
  const [readingPage, setReadingPage] = useState<number | undefined>(undefined);

  const [deepResults, setDeepResults] = useState<DeepSearchResult[] | null>(null);
  const [deepSearching, setDeepSearching] = useState(false);

  const studentClass = appUser?.class ?? 'XI';

  useEffect(() => {
    const q = query(collection(db, 'materials'), where('class', '==', studentClass));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Material));
    });
    return unsub;
  }, [studentClass]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = collection(db, 'users', firebaseUser.uid, 'bookmarks');
    const unsub = onSnapshot(q, (snap) => {
      setBookmarkedIds(new Set(snap.docs.map((d) => d.id)));
    });
    return unsub;
  }, [firebaseUser]);

  const toggleBookmark = async (material: Material) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid, 'bookmarks', material.id);
    if (bookmarkedIds.has(material.id)) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { materialId: material.id, createdAt: serverTimestamp() });
    }
  };

  const handleDownload = (material: Material) => {
    // Fire-and-forget: don't block the download on this write.
    updateDoc(doc(db, 'materials', material.id), { downloadCount: increment(1) }).catch(() => {});
    window.open(material.downloadURL, '_blank', 'noopener');
  };

  const handleOpenAtPage = (material: Material, pageNumber: number) => {
    setReading(material);
    setReadingPage(pageNumber);
  };

  const handleRead = (material: Material) => {
    setReading(material);
    setReadingPage(undefined);
  };

  const handleDeepSearch = async () => {
    const term = search.trim();
    if (!term) return;
    setDeepSearching(true);
    setDeepResults(null);
    try {
      const indexedMaterials = materials.filter((m) => m.textIndexed);
      const resultsByMaterial = await Promise.all(
        indexedMaterials.map(async (material) => {
          const pagesSnap = await getDocs(collection(db, 'materials', material.id, 'pages'));
          const matches: DeepSearchResult[] = [];
          pagesSnap.forEach((p) => {
            const data = p.data() as { pageNumber: number; text: string };
            if (data.text.toLowerCase().includes(term.toLowerCase())) {
              matches.push({ material, pageNumber: data.pageNumber, snippet: buildSnippet(data.text, term) });
            }
          });
          return matches;
        })
      );
      const flattened = resultsByMaterial.flat().sort((a, b) => a.material.title.localeCompare(b.material.title));
      setDeepResults(flattened);
    } finally {
      setDeepSearching(false);
    }
  };

  const clearDeepSearch = () => setDeepResults(null);

  const filtered = useMemo(() => {
    const base = tab === 'bookmarked' ? materials.filter((m) => bookmarkedIds.has(m.id)) : materials;
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter(
      (m) => m.title.toLowerCase().includes(q) || m.chapter.toLowerCase().includes(q)
    );
  }, [materials, search, tab, bookmarkedIds]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setDeepResults(null);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2, pb: 6 }}>
      <Typography variant="h4" gutterBottom>Materials</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Class {studentClass} — notes, PDFs and references uploaded by your teachers.
      </Typography>

      <TextField
        placeholder="Search by title or chapter…"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleDeepSearch()}
        fullWidth
        sx={{ mb: 1 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />
      <Button
        size="small"
        startIcon={deepSearching ? <CircularProgress size={16} /> : <TravelExploreIcon />}
        onClick={handleDeepSearch}
        disabled={!search.trim() || deepSearching}
        sx={{ mb: 2 }}
      >
        {deepSearching ? 'Searching inside PDFs…' : 'Also search inside PDFs'}
      </Button>

      {deepResults !== null ? (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {deepResults.length} match{deepResults.length === 1 ? '' : 'es'} for "{search}" inside indexed PDFs
            </Typography>
            <Button size="small" onClick={clearDeepSearch}>Back to browsing</Button>
          </Stack>
          <Paper variant="outlined">
            <List>
              {deepResults.map((r, i) => (
                <ListItem
                  key={`${r.material.id}-${r.pageNumber}-${i}`}
                  secondaryAction={
                    <Button size="small" variant="outlined" onClick={() => handleOpenAtPage(r.material, r.pageNumber)}>
                      Open p.{r.pageNumber}
                    </Button>
                  }
                >
                  <ListItemIcon>{TYPE_ICON[r.material.type]}</ListItemIcon>
                  <ListItemText
                    primary={`${r.material.title} — page ${r.pageNumber}`}
                    secondary={r.snippet}
                  />
                </ListItem>
              ))}
              {deepResults.length === 0 && (
                <ListItem><ListItemText primary="No matches found inside any indexed PDF." /></ListItem>
              )}
            </List>
          </Paper>
        </>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="all" label="All" />
            <Tab value="bookmarked" label="Bookmarked" />
          </Tabs>

          <Paper variant="outlined">
            <List>
              {filtered.map((m) => (
                <ListItem
                  key={m.id}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton onClick={() => handleRead(m)} title="Read online">
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDownload(m)} title="Download">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton onClick={() => toggleBookmark(m)} title="Bookmark">
                        {bookmarkedIds.has(m.id) ? <BookmarkIcon color="secondary" /> : <BookmarkBorderIcon />}
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemIcon>{TYPE_ICON[m.type]}</ListItemIcon>
                  <ListItemText
                    primary={m.title}
                    secondary={<Chip size="small" label={m.chapter} sx={{ mt: 0.5 }} />}
                  />
                </ListItem>
              ))}
              {filtered.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={tab === 'bookmarked' ? 'No bookmarks yet.' : 'No materials match your search.'}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </>
      )}

      <ReaderDialog
        material={reading}
        initialPage={readingPage}
        onClose={() => {
          setReading(null);
          setReadingPage(undefined);
        }}
      />
    </Box>
  );
}
