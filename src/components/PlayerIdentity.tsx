import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Check, Pencil } from 'lucide-react';
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

  // No name set — show inline prompt
  if (!name && !editing) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => { setDraft(''); setEditing(true); }}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors group"
      >
        <User className="h-3 w-3" />
        <span className="group-hover:underline">Set your name</span>
      </motion.button>
    );
  }

  // Editing mode
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

  // Name set — show compact chip
  return (
    <AnimatePresence mode="wait">
      <motion.button
        key="identity-chip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => { setDraft(name || ''); setEditing(true); }}
        className="flex items-center gap-1.5 text-[11px] text-foreground/70 hover:text-foreground transition-colors group max-w-[120px]"
        title="Click to edit name"
      >
        <User className="h-3 w-3 shrink-0 text-primary/60" />
        <span className="truncate font-medium">{name}</span>
        <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      </motion.button>
    </AnimatePresence>
  );
}
