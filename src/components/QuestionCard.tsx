import { useEffect } from 'react';
import { Paper, Typography, RadioGroup, FormControlLabel, Radio, Box, Chip, IconButton, Tooltip } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { isTtsSupported, speak, stopSpeaking } from '../utils/speech';
import type { Question } from '../types';
import { difficultyColor } from '../theme';

export function QuestionCard({
  question,
  index,
  total,
  selectedIndex,
  flagged,
  onSelect,
  onToggleFlag,
}: {
  question: Question;
  index: number;
  total: number;
  selectedIndex: number | null;
  flagged: boolean;
  onSelect: (index: number) => void;
  onToggleFlag: () => void;
}) {
  // Stop any in-progress speech when moving to a different question, or
  // leaving the page — otherwise a question could keep being read aloud
  // after the student has already moved on.
  useEffect(() => stopSpeaking, [question.id]);

  const handleReadAloud = () => {
    const optionsText = question.options.map((opt, i) => `Option ${i + 1}: ${opt}`).join('. ');
    speak(`${question.questionText}. ${optionsText}`);
  };

  return (
    <Paper variant="outlined" sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Question {index + 1} of {total}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={question.difficulty}
            size="small"
            sx={{ bgcolor: difficultyColor[question.difficulty], color: '#fff', textTransform: 'capitalize' }}
          />
          {isTtsSupported() && (
            <Tooltip title="Read question aloud">
              <IconButton onClick={handleReadAloud}>
                <VolumeUpIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={flagged ? 'Unflag for review' : 'Flag for review'}>
            <IconButton onClick={onToggleFlag} color={flagged ? 'secondary' : 'default'}>
              {flagged ? <FlagIcon /> : <FlagOutlinedIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Typography variant="h5" sx={{ mb: 3 }}>
        {question.questionText}
      </Typography>

      <RadioGroup
        value={selectedIndex ?? ''}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {question.options.map((option, i) => (
          <FormControlLabel
            key={i}
            value={i}
            control={<Radio />}
            label={option}
            sx={{
              border: '1px solid',
              borderColor: selectedIndex === i ? 'primary.main' : 'divider',
              borderRadius: 2,
              mx: 0,
              mb: 1.5,
              px: 2,
              py: 0.5,
              bgcolor: selectedIndex === i ? 'action.selected' : 'transparent',
            }}
          />
        ))}
      </RadioGroup>
    </Paper>
  );
}
