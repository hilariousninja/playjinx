import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

function getTimeUntilMidnightUTC() {
  const now = new Date();
  // Next UTC midnight
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

export default function Countdown() {
  const [time, setTime] = useState(getTimeUntilMidnightUTC);

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeUntilMidnightUTC()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-display tabular-nums">
      <Clock className="h-3 w-3" />
      <span>Next prompts in: {time.hours}h {time.minutes}m</span>
    </div>
  );
}
