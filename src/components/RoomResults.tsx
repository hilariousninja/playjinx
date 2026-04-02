import { motion } from 'framer-motion';
import { Users, Zap } from 'lucide-react';
import type { RoomPromptResult, RoomParticipant } from '@/lib/challenge-room';
import { getPlayerId } from '@/lib/store';
import PromptPair from './PromptPair';

interface RoomResultsProps {
  results: RoomPromptResult[];
  participants: RoomParticipant[];
}

export default function RoomResults({ results, participants }: RoomResultsProps) {
  const mySessionId = getPlayerId();
  const myName = participants.find(p => p.session_id === mySessionId)?.display_name ?? 'You';

  if (participants.length < 2) return null;

  // Find who matched you the most
  const matchCounts = new Map<string, number>();
  for (const r of results) {
    const myAnswer = r.answers.find(a => a.session_id === mySessionId);
    if (!myAnswer) continue;
    for (const a of r.answers) {
      if (a.session_id === mySessionId) continue;
      if (a.normalized_answer === myAnswer.normalized_answer) {
        matchCounts.set(a.display_name, (matchCounts.get(a.display_name) ?? 0) + 1);
      }
    }
  }

  const bestMatch = Array.from(matchCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      {/* Room header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 mb-2">
          <Users className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-display font-bold text-primary uppercase tracking-[0.1em]">
            Room · {participants.length} players
          </span>
        </div>
        {bestMatch && (
          <p className="text-xs text-muted-foreground">
            Best match: <span className="font-semibold text-foreground">{bestMatch[0]}</span>
            <span className="text-primary ml-1">({bestMatch[1]}/{results.length} JINX)</span>
          </p>
        )}
      </div>

      {/* Per-prompt clusters */}
      {results.map((r, i) => (
        <motion.div
          key={r.prompt_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08 }}
          className="rounded-xl border border-border/60 bg-card overflow-hidden"
        >
          <div className="px-4 pt-3 pb-2">
            <PromptPair wordA={r.word_a} wordB={r.word_b} size="sm" />
          </div>
          <div className="px-4 pb-3 space-y-1.5">
            {r.clusters.map((cluster) => {
              const isMyCluster = cluster.members.includes(myName);
              const isJinx = cluster.members.length >= 2;
              return (
                <div
                  key={cluster.answer}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${
                    isJinx
                      ? 'bg-[hsl(var(--match-best)/0.06)]'
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isJinx && <Zap className="h-3 w-3 text-[hsl(var(--match-best))] shrink-0" />}
                    <span className={`font-display font-bold truncate ${
                      isMyCluster ? 'text-foreground' : 'text-foreground/70'
                    }`}>
                      {cluster.answer}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {cluster.members.map((name) => (
                      <span
                        key={name}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-display ${
                          name === myName
                            ? 'bg-primary/15 text-primary font-bold'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
