import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

function getTimeUntilMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

export default function Countdown() {
  const [time, setTime] = useState(getTimeUntilMidnight);

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeUntilMidnight()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-display tabular-nums">
      <Clock className="h-3 w-3" />
      <span>Next prompts in: {time.hours}h {time.minutes}m</span>
    </div>
  );
}
