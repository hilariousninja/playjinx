import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Loader2, AlertCircle, Lock, Calendar, Flame, Users, Sparkles, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import PromptPair from '@/components/PromptPair';
import { getGroupByInviteCode, getPairData, getPairEnrichment, type PairData, type PairEnrichment } from '@/lib/groups';

export default function GroupPair() {
  const { inviteCode, otherSessionId } = useParams<{ inviteCode: string; otherSessionId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PairData | null>(null);
  const [enrichment, setEnrichment] = useState<PairEnrichment | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode || !otherSessionId) { setError('Invalid link'); setLoading(false); return; }
    (async () => {
      try {
        const g = await getGroupByInviteCode(inviteCode);
        if (!g) { setError('Group not found'); setLoading(false); return; }
        setGroupName(g.name);
        const [pd, en] = await Promise.all([
          getPairData(g.id, otherSessionId),
          getPairEnrichment(g.id, otherSessionId),
        ]);
        if (!pd) { setError("This pair isn't available"); setLoading(false); return; }
        setData(pd);
        setEnrichment(en);
        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [inviteCode, otherSessionId]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-[15px] font-bold text-foreground">{error}</h2>
        <Button className="rounded-lg" onClick={() => navigate(`/g/${inviteCode}/today`)}>Back to group</Button>
      </div>
    </div>
  );

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-3 pb-8">
        {/* Back */}
        <Link
          to={`/g/${inviteCode}/today`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-[8px]"
        >
          <ArrowLeft className="h-3 w-3" /> {groupName}
        </Link>

        {/* Header: You × Them */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-[10px] mb-[12px]"
        >
          <Avatar name={data.me.display_name + ' (you)'} accent="primary" />
          <span className="text-[16px] font-bold text-muted-foreground/40">×</span>
          <Avatar name={data.them.display_name} accent="info" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-foreground truncate leading-tight">
              You × {data.them.display_name}
            </p>
            <p className="text-[10px] text-muted-foreground mt-[1px]">in {groupName}</p>
          </div>
        </motion.div>

        {/* Stat trio */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-[6px] mb-[14px]"
        >
          <StatBlock icon={<Zap className="h-3 w-3 text-primary" />} label="Jinxes" value={data.totalJinxes} accent="primary" />
          <StatBlock icon={<Calendar className="h-3 w-3 text-muted-foreground" />} label="Days both" value={data.daysPlayedTogether} />
          <StatBlock icon={<Flame className="h-3 w-3 text-[hsl(var(--info))]" />} label="Streak" value={data.currentStreak} />
        </motion.div>

        {/* Rivalry meter */}
        {enrichment?.rivalry && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className="mb-[14px] rounded-[12px] border border-foreground/[0.06] bg-card p-[12px]"
          >
            <div className="flex items-center justify-between mb-[6px]">
              <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/50 font-semibold">Rivalry</span>
              <span className="text-[13px] font-bold text-foreground">{enrichment.rivalry}</span>
            </div>
            <div className="h-[6px] rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.max(4, Math.round(enrichment.rivalryScore * 100))}%` }}
              />
            </div>
            <p className="mt-[6px] text-[10px] text-muted-foreground/60 leading-[1.4]">
              {rivalryBlurb(enrichment.rivalry, enrichment.rivalryScore)}
            </p>
          </motion.div>
        )}

        {/* Shared signatures */}
        {enrichment && enrichment.signatures.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
            className="mb-[14px]"
          >
            <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px] flex items-center gap-[4px]">
              <Sparkles className="h-2.5 w-2.5" /> Your shared signatures
            </p>
            <div className="flex flex-wrap gap-[5px]">
              {enrichment.signatures.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-[5px] px-[10px] py-[5px] rounded-full bg-primary/[0.07] border border-primary/15 text-[11px] font-bold text-foreground"
                >
                  {s.answer}
                  <span className="text-[9px] text-primary/70 font-semibold">×{s.occurrences}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Most divisive */}
        {enrichment?.divisive && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11 }}
            className="mb-[14px] rounded-[12px] border border-foreground/[0.06] bg-card p-[12px]"
          >
            <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px] flex items-center gap-[4px]">
              <Split className="h-2.5 w-2.5" /> Most divisive
            </p>
            <PromptPair wordA={enrichment.divisive.word_a} wordB={enrichment.divisive.word_b} size="sm" />
            <div className="mt-[8px] grid grid-cols-2 gap-[5px]">
              <div className="rounded-[8px] bg-muted/40 px-[8px] py-[8px] text-center">
                <p className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/50 font-semibold mb-[2px]">You</p>
                <p className="text-[12px] font-bold text-foreground break-words">{enrichment.divisive.myAnswer}</p>
              </div>
              <div className="rounded-[8px] bg-muted/40 px-[8px] py-[8px] text-center">
                <p className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/50 font-semibold mb-[2px] truncate">{data.them.display_name}</p>
                <p className="text-[12px] font-bold text-foreground break-words">{enrichment.divisive.theirAnswer}</p>
              </div>
            </div>
          </motion.div>
        )}



        {/* Today */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-[14px]"
        >
          <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px]">Today</p>
          {data.todayPrompts.length === 0 ? (
            <div className="rounded-[10px] bg-muted/40 p-[12px] text-center">
              <p className="text-[11px] text-muted-foreground/60">No prompts today yet</p>
            </div>
          ) : (
            <div className="space-y-[6px]">
              {data.todayPrompts.map(p => (
                <div key={p.prompt_id} className="rounded-[10px] bg-card border border-foreground/[0.06] p-[10px]">
                  <PromptPair wordA={p.word_a} wordB={p.word_b} size="sm" />
                  <div className="mt-[8px] grid grid-cols-2 gap-[5px]">
                    <AnswerCell label="You" answer={p.myAnswer} locked={!data.viewerPlayedToday} matched={p.matched} />
                    <AnswerCell label={data.them.display_name} answer={p.theirAnswer} locked={!data.viewerPlayedToday} matched={p.matched} />
                  </div>
                  {p.matched && (
                    <p className="mt-[6px] text-center text-[10px] font-bold text-primary flex items-center justify-center gap-[3px]">
                      <Zap className="h-2.5 w-2.5 fill-primary" /> JINX
                    </p>
                  )}
                </div>
              ))}
              {!data.viewerPlayedToday && (
                <Button asChild className="w-full rounded-[10px] h-9 text-[12px] font-bold mt-[4px]">
                  <Link to="/play">Play to reveal today</Link>
                </Button>
              )}
            </div>
          )}
        </motion.div>

        {/* Recent jinxes */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[6px]">
            Recent jinxes
          </p>
          {data.recentJinxes.length === 0 ? (
            <div className="rounded-[10px] bg-muted/40 p-[14px] text-center space-y-1">
              <Users className="h-4 w-4 text-muted-foreground/30 mx-auto" />
              <p className="text-[11px] text-muted-foreground/60">No jinxes together yet</p>
              <p className="text-[10px] text-muted-foreground/40">Play more days to build your match history</p>
            </div>
          ) : (
            <div className="space-y-[5px]">
              {data.recentJinxes.map((j, i) => (
                <div
                  key={`${j.date}-${i}`}
                  className="flex items-center gap-[8px] px-[10px] py-[7px] rounded-[8px] bg-primary/[0.05] border border-primary/10"
                >
                  <Zap className="h-3 w-3 text-primary shrink-0 fill-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-foreground truncate leading-tight">{j.answer}</p>
                    <p className="text-[9px] text-muted-foreground/60 leading-tight mt-[1px]">
                      {j.word_a} + {j.word_b}
                    </p>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0 tabular-nums">{formatDate(j.date)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

function Avatar({ name, accent }: { name: string; accent: 'primary' | 'info' }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const cls = accent === 'primary'
    ? 'bg-primary/12 border-primary/20 text-primary'
    : 'bg-[hsl(var(--info))]/12 border-[hsl(var(--info))]/20 text-[hsl(var(--info))]';
  return (
    <div className={`w-[34px] h-[34px] rounded-full border flex items-center justify-center shrink-0 ${cls}`}>
      <span className="text-[11px] font-bold">{initials}</span>
    </div>
  );
}

function StatBlock({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: 'primary' }) {
  return (
    <div className={`rounded-[10px] border p-[10px] ${accent === 'primary' ? 'bg-primary/[0.05] border-primary/15' : 'bg-card border-foreground/[0.06]'}`}>
      <div className="flex items-center gap-[3px] mb-[2px]">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 font-semibold">{label}</span>
      </div>
      <p className={`text-[20px] font-bold tabular-nums leading-none ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

function AnswerCell({ label, answer, locked, matched }: { label: string; answer: string | null; locked: boolean; matched: boolean }) {
  if (locked) {
    return (
      <div className="rounded-[8px] bg-muted/50 px-[8px] py-[10px] text-center">
        <p className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/40 font-semibold mb-[3px]">{label}</p>
        <Lock className="h-3 w-3 text-muted-foreground/40 mx-auto" />
      </div>
    );
  }
  return (
    <div className={`rounded-[8px] px-[8px] py-[8px] text-center ${matched ? 'bg-primary/[0.08] border border-primary/15' : 'bg-muted/40'}`}>
      <p className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/50 font-semibold mb-[2px] truncate">{label}</p>
      <p className={`text-[12px] font-bold break-words ${answer ? 'text-foreground' : 'text-muted-foreground/40'}`}>
        {answer ?? '—'}
      </p>
    </div>
  );
}

function rivalryBlurb(rivalry: 'Twin' | 'Sync' | 'Wildcard' | 'Opposite', score: number): string {
  const pct = Math.round(score * 100);
  switch (rivalry) {
    case 'Twin': return `You match on ${pct}% of days you both played. Eerie.`;
    case 'Sync': return `You match on ${pct}% of days you both played.`;
    case 'Wildcard': return `You match on ${pct}% of days — unpredictable pair.`;
    case 'Opposite': return `You almost never match. Opposite brains.`;
  }
}
