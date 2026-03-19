import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Hash, TrendingUp, Award, Crown } from 'lucide-react';
import { getStats, getUserAnswer, getPromptById, getTotalSubmissions, type AnswerStat, type DbPrompt, type DbAnswer } from '@/lib/store';

interface Props {
  promptId: string;
}

export default function ResultsView({ promptId }: Props) {
  const [stats, setStats] = useState<AnswerStat[]>([]);
  const [prompt, setPrompt] = useState<DbPrompt | null>(null);
  const [userAnswer, setUserAnswer] = useState<DbAnswer | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, p, ua, t] = await Promise.all([
      getStats(promptId),
      getPromptById(promptId),
      getUserAnswer(promptId),
      getTotalSubmissions(promptId),
    ]);
    setStats(s);
    setPrompt(p);
    setUserAnswer(ua);
    setTotal(t);
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) return (
    <div className="game-card text-center py-10">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Loading results…</p>
    </div>
  );

  const unique = stats.length;
  const userStat = stats.find(s => s.normalized_answer === userAnswer?.normalized_answer);
  const topAnswer = stats.length > 0 ? stats[0] : null;
  const rank = userStat?.rank ?? 0;
  const percentile = total > 0 && userStat ? Math.round(((total - rank) / total) * 100) : 0;
  const topPercent = Math.max(1, 100 - percentile);
  const isEarly = total < 5;
  const matchCount = userStat?.count ?? 0;

  return (
    <div className="space-y-4">
      {/* Early bird */}
      {isEarly && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="game-card text-center py-4">
          <p className="text-xs text-muted-foreground">🌅 You're early! Results will grow as more players answer.</p>
        </motion.div>
      )}

      {/* #1 Answer highlight */}
      {topAnswer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="game-card text-center py-5"
        >
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">#1 Answer</span>
          </div>
          <p className="font-display text-2xl font-bold text-foreground mb-1 break-words">{topAnswer.normalized_answer}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{topAnswer.percentage}%</span>
            <span className="text-muted-foreground/50 mx-1">·</span>
            <span>{topAnswer.count} {topAnswer.count === 1 ? 'player' : 'players'}</span>
          </p>
        </motion.div>
      )}

      {/* Your answer card */}
      {userStat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="game-card-elevated text-center py-6"
        >
          <Award className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">You chose</p>
          <p className="font-display text-3xl font-bold mb-3 text-primary break-words">{userAnswer?.raw_answer}</p>

          <div className="flex justify-center gap-2 flex-wrap">
            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-display">
              Current Rank <span className="font-bold text-foreground">#{rank}</span>
            </span>
            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-display">
              <span className="font-bold text-foreground">{matchCount}</span> {matchCount === 1 ? 'match' : 'matches'}
            </span>
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-display font-bold">
              Top {topPercent}%
            </span>
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, value: total, label: 'Players' },
          { icon: Hash, value: unique, label: 'Unique' },
          { icon: TrendingUp, value: `${topAnswer?.percentage ?? 0}%`, label: 'Top Answer' },
        ].map((stat) => (
          <div key={stat.label} className="game-card text-center py-3 px-2">
            <stat.icon className="h-3.5 w-3.5 mx-auto mb-1.5 text-muted-foreground/50" />
            <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Answer clusters */}
      <div className="game-card">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-5 font-medium">Answer Clusters</p>
        <div className="space-y-2">
          {stats.slice(0, 8).map((s, i) => {
            const isUser = s.normalized_answer === userAnswer?.normalized_answer;
            return (
              <motion.div
                key={s.normalized_answer}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`py-2 px-2 rounded-lg -mx-2 ${isUser ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className={`font-display text-[11px] tabular-nums shrink-0 ${i === 0 ? 'text-primary font-bold' : 'text-muted-foreground/50'}`}>
                      {i + 1}
                    </span>
                    <span className={`font-display text-sm break-words min-w-0 ${isUser ? 'text-primary font-bold' : 'text-foreground'}`}>
                      {s.normalized_answer}
                    </span>
                  </div>
                  <span className={`text-xs tabular-nums whitespace-nowrap shrink-0 ${isUser ? 'text-primary font-bold' : 'text-muted-foreground/70'}`}>
                    {s.percentage}%
                    <span className="text-muted-foreground/40 ml-1 text-[10px]">({s.count})</span>
                  </span>
                </div>
                <div className="cluster-bar ml-5" style={{ height: '6px' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(s.percentage, 4)}%` }}
                    transition={{ duration: 0.7, delay: 0.12 + i * 0.06, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${
                      isUser
                        ? 'bg-primary/60'
                        : i === 0
                          ? 'bg-primary/20'
                          : 'bg-muted-foreground/10'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No answers yet — be the first!</p>
        )}
      </div>

      {/* Wild answers — fun one-offs */}
      {(() => {
        const wildAnswers = stats.filter(s => s.count === 1).slice(0, 5);
        if (wildAnswers.length === 0 || total < 5) return null;
        return (
          <div className="game-card">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-3 font-medium">🎲 Wild Answers</p>
            <div className="flex flex-wrap gap-1.5">
              {wildAnswers.map(s => {
                const isUser = s.normalized_answer === userAnswer?.normalized_answer;
                return (
                  <span
                    key={s.normalized_answer}
                    className={`px-2.5 py-1 rounded-full text-xs font-display ${
                      isUser ? 'bg-primary/10 text-primary font-bold' : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {s.normalized_answer}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Scoring explainer */}
      <div className="game-card text-center py-4 px-5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2 font-medium">How scoring works</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          You score higher when more people match your answer. Your rank depends on how popular your answer is.
        </p>
      </div>

      {/* Live indicator */}
      <div className="text-center space-y-1 py-1">
        <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
          Results are still updating — your rank may change
        </p>
        <p className="text-[10px] text-muted-foreground/40">Check back later to see how your answer performs</p>
      </div>
    </div>
  );
}
