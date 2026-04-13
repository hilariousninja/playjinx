import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Pencil } from 'lucide-react';
import { getDisplayName, setDisplayName } from '@/lib/challenge-room';

export default function PlayerIdentity() {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(getDisplayName());
  }, []);

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed.length <= 20) {
      setDisplayName(trimmed);
      setName(trimmed);
      setEditing(false);
    }
  };

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (!name && !editing) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => { setDraft(''); setEditing(true); }}
        className="flex items-center gap-[5px] bg-card border border-foreground/[0.08] rounded-full py-[3px] pl-[3px] pr-[9px] cursor-pointer hover:border-foreground/15 transition-colors"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(var(--logo-accent))] to-[hsl(var(--primary))] flex items-center justify-center text-[9px] font-bold text-white">
          ?
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">Set name</span>
      </motion.button>
    );
  }

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); } }}
          placeholder="Your name…"
          maxLength={20}
          className="h-6 w-24 px-2 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary"
        />
        <button
          onClick={save}
          disabled={!draft.trim()}
          className="h-6 w-6 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          <Check className="h-3 w-3" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.button
        key="identity-chip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => { setDraft(name || ''); setEditing(true); }}
        className="flex items-center gap-[5px] bg-card border border-foreground/[0.08] rounded-full py-[3px] pl-[3px] pr-[9px] cursor-pointer hover:border-foreground/15 transition-colors"
        title="Click to edit name"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(var(--logo-accent))] to-[hsl(var(--primary))] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          {initial}
        </div>
        <span className="text-[11px] font-medium text-foreground truncate max-w-[80px]">{name}</span>
      </motion.button>
    </AnimatePresence>
  );
}
