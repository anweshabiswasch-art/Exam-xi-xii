import { createTheme } from '@mui/material/styles';

// Palette: ink navy (authority, exam-hall focus) + a warm gold-ochre accent
// (the underline of a well-marked essay, not a generic AI-orange).
const palette = {
  ink: '#16294B',
  inkLight: '#274877',
  parchment: '#FBF9F4',
  gold: '#B98A2E',
  correct: '#2E7D46',
  incorrect: '#B3261E',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: palette.ink, light: palette.inkLight, contrastText: '#fff' },
    secondary: { main: palette.gold, contrastText: '#1A1400' },
    success: { main: palette.correct },
    error: { main: palette.incorrect },
    background: { default: palette.parchment, paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 700 },
    h2: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 700 },
    h3: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    h4: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    h5: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 20 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});

export const difficultyColor = {
  easy: '#2E7D46',
  medium: '#B98A2E',
  hard: '#B3261E',
} as const;
