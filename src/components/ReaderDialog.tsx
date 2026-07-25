import { Dialog, DialogTitle, DialogContent, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Material } from '../types';

export function ReaderDialog({
  material,
  initialPage,
  onClose,
}: {
  material: Material | null;
  initialPage?: number;
  onClose: () => void;
}) {
  if (!material) return null;

  const pdfSrc = initialPage ? `${material.downloadURL}#page=${initialPage}` : material.downloadURL;

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {material.title}
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: '100%' }}>
        {material.type === 'pdf' && (
          <Box
            component="iframe"
            src={pdfSrc}
            title={material.title}
            sx={{ width: '100%', height: '100%', border: 0 }}
          />
        )}
        {material.type === 'image' && (
          <Box
            component="img"
            src={material.downloadURL}
            alt={material.title}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#000' }}
          />
        )}
        {(material.type === 'docx' || material.type === 'note') && (
          <Box
            component="iframe"
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(material.downloadURL)}&embedded=true`}
            title={material.title}
            sx={{ width: '100%', height: '100%', border: 0 }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
