import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DisplayNameInputProps {
  onSubmit: (name: string) => void;
  defaultValue?: string;
  loading?: boolean;
}

export default function DisplayNameInput({ onSubmit, defaultValue = '', loading }: DisplayNameInputProps) {
  const [name, setName] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a display name');
      return;
    }
    if (trimmed.length > 20) {
      setError('Keep it under 20 characters');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="w-full max-w-xs mx-auto"
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <User className="h-4 w-4 text-primary" />
        <p className="text-sm font-display font-semibold text-foreground">What should we call you?</p>
      </div>
      <p className="text-[11px] text-muted-foreground/60 text-center mb-4">
        So your friends know who matched whom
      </p>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Your name…"
          className="rounded-xl text-center font-display h-12 text-base border-2 focus:border-primary focus:ring-0 placeholder:text-muted-foreground/25"
          maxLength={20}
          autoFocus
          disabled={loading}
        />
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || loading}
          className="rounded-xl h-12 px-4 bg-primary hover:bg-primary/90 shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive mt-2 text-center">{error}</p>}
    </motion.div>
  );
}
