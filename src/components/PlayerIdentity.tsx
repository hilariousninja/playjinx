import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { getDisplayName, setDisplayName, findExistingIdentities, claimIdentity, type ExistingIdentity } from '@/lib/challenge-room';
import ProfileStatsPanel from '@/components/ProfileStatsPanel';

export default function PlayerIdentity() {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [claimPrompt, setClaimPrompt] = useState<{ name: string; matches: ExistingIdentity[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(getDisplayName());
  }, []);

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 20) return;
    setChecking(true);
    try {
      const matches = await findExistingIdentities(trimmed);
      if (matches.length > 0) {
        setClaimPrompt({ name: trimmed, matches });
        return;
      }
      setDisplayName(trimmed);
      setName(trimmed);
      setEditing(false);
    } finally {
      setChecking(false);
    }
  };

  const claim = (m: ExistingIdentity) => {
    claimIdentity(m.session_id, m.display_name);
    setName(m.display_name);
    setClaimPrompt(null);
    setEditing(false);
    // Reload so all queries (groups, history, answers) refetch under the
    // newly-adopted session id.
    window.location.reload();
  };

  const useAsNew = () => {
    if (!claimPrompt) return;
    setDisplayName(claimPrompt.name);
    setName(claimPrompt.name);
    setClaimPrompt(null);
    setEditing(false);
  };

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (!name && !editing) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => { setDraft(''); setEditing(true); }}
        className="flex items-center gap-[6px] bg-primary/10 border border-primary/20 rounded-full py-[4px] pl-[4px] pr-[10px] cursor-pointer hover:bg-primary/15 transition-colors"
      >
        <div className="w-[22px] h-[22px] rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-bold text-white">
          ✎
        </div>
        <span className="text-[11px] font-semibold text-primary">Add your name</span>
      </motion.button>
    );
  }

  if (editing) {
    return (
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setClaimPrompt(null); } }}
            placeholder="Your name…"
            maxLength={20}
            disabled={checking}
            className="h-7 w-24 px-2 text-[11px] rounded-lg border border-primary/30 bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-60"
          />
          <button
            onClick={save}
            disabled={!draft.trim() || checking}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
        </motion.div>

        {claimPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-9 z-50 w-[240px] rounded-xl border border-foreground/10 bg-card shadow-lg p-3"
          >
            <p className="text-[11px] font-semibold text-foreground mb-1">
              Welcome back?
            </p>
            <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
              Someone called <span className="font-semibold text-foreground">{claimPrompt.name}</span> has played before. Pick up where they left off?
            </p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => claim(claimPrompt.matches[0])}
                className="w-full text-[11px] font-semibold bg-primary text-primary-foreground rounded-lg py-1.5 hover:bg-primary/90 transition-colors"
              >
                Yes, that's me
              </button>
              <button
                onClick={useAsNew}
                className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                No, I'm new — use anyway
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.button
          key="identity-chip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setStatsOpen(true)}
          className="flex items-center gap-[5px] bg-card border border-foreground/[0.08] rounded-full py-[3px] pl-[3px] pr-[10px] cursor-pointer hover:border-foreground/15 transition-colors"
          title="View your JINX record"
        >
          <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[hsl(var(--logo-accent))] to-[hsl(var(--primary))] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {initial}
          </div>
          <span className="text-[11px] font-semibold text-foreground truncate max-w-[80px]">{name}</span>
        </motion.button>
      </AnimatePresence>

      <ProfileStatsPanel
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        displayName={name}
      />
    </>
  );
}
