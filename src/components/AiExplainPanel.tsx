import { useState } from 'react';
import { Box, Chip, CircularProgress, Stack, Typography, Alert, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MicIcon from '@mui/icons-material/Mic';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { isSttSupported, isTtsSupported, listenOnce, speak } from '../utils/speech';
import type { Question } from '../types';

type Mode = 'easy' | 'bengali' | 'grammar' | 'similar' | 'voice';

const MODE_LABEL: Record<Exclude<Mode, 'voice'>, string> = {
  easy: 'Explain in easy English',
  bengali: 'Explain in Bengali',
  grammar: 'Explain the grammar rule',
  similar: 'Generate 3 similar questions',
};

/**
 * Calls /.netlify/functions/ai-explain — see netlify/functions/ai-explain.ts.
 * The question, correct answer and explanation are only ever sent to this
 * panel AFTER the test has been submitted and scored, so the AI can never
 * leak the answer during the exam itself.
 */
export function AiExplainPanel({ question }: { question: Question }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [voiceQuestion, setVoiceQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const askAi = async (selected: Mode, transcript?: string) => {
    setMode(selected);
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/.netlify/functions/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selected,
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.options[question.correctAnswerIndex],
          explanation: question.explanation,
          ...(transcript ? { voiceQuestion: transcript } : {}),
        }),
      });
      if (!res.ok) throw new Error(`AI service returned ${res.status}`);
      const data = await res.json();
      setResponse(data.text as string);
      if (selected === 'voice' && isTtsSupported()) {
        speak(data.text as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI explanation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceAsk = async () => {
    setError(null);
    setListening(true);
    try {
      const transcript = await listenOnce();
      setVoiceQuestion(transcript);
      await askAi('voice', transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hear you. Try again.');
    } finally {
      setListening(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        {(Object.keys(MODE_LABEL) as Exclude<Mode, 'voice'>[]).map((m) => (
          <Chip
            key={m}
            icon={<AutoAwesomeIcon fontSize="small" />}
            label={MODE_LABEL[m]}
            onClick={() => askAi(m)}
            variant={mode === m ? 'filled' : 'outlined'}
            color="secondary"
            clickable
          />
        ))}
        {isSttSupported() && (
          <Chip
            icon={<MicIcon fontSize="small" />}
            label={listening ? 'Listening…' : 'Ask by voice'}
            onClick={handleVoiceAsk}
            variant={mode === 'voice' ? 'filled' : 'outlined'}
            color={listening ? 'error' : 'secondary'}
            clickable
            disabled={listening}
          />
        )}
      </Stack>

      {voiceQuestion && mode === 'voice' && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: 'italic' }}>
          You asked: "{voiceQuestion}"
        </Typography>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Asking AI…</Typography>
        </Box>
      )}
      {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      {response && (
        <Alert
          severity="info"
          icon={<AutoAwesomeIcon />}
          sx={{ mt: 2, whiteSpace: 'pre-wrap' }}
          action={
            isTtsSupported() ? (
              <Tooltip title="Read aloud">
                <IconButton size="small" onClick={() => speak(response)}>
                  <VolumeUpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : undefined
          }
        >
          {response}
        </Alert>
      )}
    </Box>
  );
}
