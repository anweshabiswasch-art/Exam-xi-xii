import { useEffect, useRef, useState } from 'react';
import { Chip } from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';

function format(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Timer({
  totalSeconds,
  onExpire,
}: {
  totalSeconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const low = remaining <= 60;

  return (
    <Chip
      icon={<TimerIcon />}
      label={format(remaining)}
      color={low ? 'error' : 'primary'}
      variant={low ? 'filled' : 'outlined'}
      sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
    />
  );
}
