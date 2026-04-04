import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, X, ArrowRight, Share2, Loader2, AlertCircle, Home, Copy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PromptPair from '@/components/PromptPair';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import RoomResults from '@/components/RoomResults';
import SocialMemoryCard from '@/components/SocialMemoryCard';
import {
  getChallengeByToken,
  getPromptsForDate,
  compareAnswers,
  buildChallengeShareText,
  isChallenger,
  type Challenge,
  type ComparisonResult,
} from '@/lib/challenge';
import { getRoomParticipants, getRoomResults, joinChallengeRoom, getDisplayName, type RoomParticipant, type RoomPromptResult } from '@/lib/challenge-room';
import { getCompletedPrompts } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { DbPrompt } from '@/lib/store';
import { toast } from '@/hooks/use-toast';

type ViewTab = 'personal' | 'room' | 'crowd';

function getSummary(matches: number, total: number) {
  if (matches === total) return { headline: 'Perfect JINX!', sub: `You matched on all ${total} — same wavelength`, emoji: '⚡', tone: 'best' as const };
  if (matches >= total - 1 && total >= 3) return { headline: `${matches} out of ${total}!`, sub: 'So close to a perfect JINX', emoji: '🧠', tone: 'strong' as const };
  if (matches >= 1) return { headline: `${matches} out of ${total}`, sub: matches === 1 ? 'One clean JINX' : 'Partial mind-meld', emoji: '🎯', tone: 'decent' as const };
  return { headline: 'No JINX today', sub: 'Completely different wavelengths', emoji: '💭', tone: 'miss' as const };
}

export default function ChallengeCompare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [prompts, setPrompts] = useState<DbPrompt[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [roomResults, setRoomResults] = useState<RoomPromptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('personal');
  const [socialRefreshKey, setSocialRefreshKey] = useState(0);
  const matchesRecorded = useRef(false);

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }

    (async () => {
      try {
        const ch = await getChallengeByToken(token);
        if (!ch) { setError('Challenge not found'); setLoading(false); return; }
        setChallenge(ch);

        const ps = await getPromptsForDate(ch.date);
        if (ps.length === 0) { setError('Prompts not available'); setLoading(false); return; }
        setPrompts(ps);

        const completed = getCompletedPrompts();
        const allPlayed = ps.every(p => completed.has(p.id));

        if (!allPlayed && !isChallenger(ch)) {
          navigate(`/c/${token}`, { replace: true });
          return;
        }

        // Ensure participant record exists
        const savedName = getDisplayName();
        if (savedName) {
          try { await joinChallengeRoom(ch.id, savedName); } catch { /* ok */ }
        }

        // Load personal comparison + room data in parallel
        const [comparison, parts, room] = await Promise.all([
          compareAnswers(ch, ps),
          getRoomParticipants(ch.id),
          getRoomResults(ch.id, ps.map(p => p.id)),
        ]);

        setResults(comparison);
        setParticipants(parts);
        setRoomResults(room);

        // Auto-select room tab if multiple participants
        if (parts.length >= 2) {
          setActiveTab('room');
        }

        // Record match history for social memory
        if (!matchesRecorded.current && parts.length >= 2 && room.length > 0) {
          matchesRecorded.current = true;
          const mySessionId = (await import('@/lib/store')).getPlayerId();
          const myAnswers = new Map<string, string>();
          for (const r of room) {
            const myA = r.answers.find(a => a.session_id === mySessionId);
            if (myA) myAnswers.set(r.prompt_id, myA.normalized_answer);
          }

          // Calculate matches per other participant
          const otherParticipants = parts.filter(p => p.session_id !== mySessionId);
          const participantMatches = otherParticipants.map(op => {
            let matched = 0;
            let total = room.length;
            for (const r of room) {
              const myNorm = myAnswers.get(r.prompt_id);
              const theirA = r.answers.find(a => a.session_id === op.session_id);
              if (myNorm && theirA && theirA.normalized_answer === myNorm) matched++;
            }
            return { sessionId: op.session_id, displayName: op.display_name, matched, total };
          });

          recordRoomMatches(ch.id, ch.date, participantMatches)
            .then(() => setSocialRefreshKey(k => k + 1))
            .catch(() => {});
        }

        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  // Realtime: listen for new participants joining the room
  const refreshRoom = useCallback(async () => {
    if (!challenge || prompts.length === 0) return;
    const [parts, room] = await Promise.all([
      getRoomParticipants(challenge.id),
      getRoomResults(challenge.id, prompts.map(p => p.id)),
    ]);
    setParticipants(parts);
    setRoomResults(room);
  }, [challenge, prompts]);

  useEffect(() => {
    if (!challenge) return;
    const channel = supabase
      .channel(`room-${challenge.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenge_participants',
          filter: `challenge_id=eq.${challenge.id}`,
        },
        () => { refreshRoom(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [challenge, refreshRoom]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Comparing answers…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-xs">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground">{error}</h2>
        <Button className="rounded-lg" asChild><Link to="/">Back home</Link></Button>
      </div>
    </div>
  );

  if (!challenge) return null;

  const matchCount = results.filter(r => r.matched).length;
  const total = results.length;
  const summary = getSummary(matchCount, total);
  const isOwn = isChallenger(challenge);
  const hasRoom = participants.length >= 2;

  const today = new Date().toISOString().split('T')[0];
  const isToday = challenge.date === today;
  const dateLabel = isToday
    ? "Today's JINX"
    : new Date(challenge.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const handleShareResult = async () => {
    const lines = results.map(r => {
      const icon = r.matched ? '🟩' : '⬜';
      return `${icon} ${r.prompt.word_a.toUpperCase()} + ${r.prompt.word_b.toUpperCase()}`;
    });
    const header = hasRoom
      ? `⚡ JINX Challenge (${participants.length} players)\nOur group matched on ${matchCount}/${total}`
      : `⚡ JINX Challenge\nWe matched on ${matchCount}/${total}`;
    const url = `${window.location.origin}/c/${challenge.token}`;
    const text = `${header}\n\n${lines.join('\n')}\n\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Result copied!', description: 'Paste it in your group chat' });
  };

  const handleShareChallenge = async () => {
    const text = buildChallengeShareText(prompts, challenge.token);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Challenge copied!', description: 'Share it with your friends' });
  };

  const tabs: { key: ViewTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'personal', label: 'vs Friend', icon: <Zap className="h-3 w-3" />, show: true },
    { key: 'room', label: 'Room', icon: <Users className="h-3 w-3" />, show: hasRoom },
    { key: 'crowd', label: 'Crowd', icon: <ArrowRight className="h-3 w-3" />, show: true },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-5">
          <Link to="/">
            <JinxLogo size={18} className="text-foreground text-base" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground/50 font-display">{dateLabel}</span>
            <PlayerIdentity />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center pt-[4vh] md:pt-[6vh] pb-8 px-5">
        <div className="w-full max-w-sm mx-auto">
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="text-center mb-5"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="text-5xl mb-3"
            >
              {summary.emoji}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`font-display font-black text-2xl tracking-tight mb-1 ${
                summary.tone === 'best' ? 'text-[hsl(var(--match-best))]' :
                summary.tone === 'strong' ? 'text-[hsl(var(--match-strong))]' :
                summary.tone === 'decent' ? 'text-[hsl(var(--match-good))]' :
                'text-foreground'
              }`}
            >
              {summary.headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-sm text-muted-foreground"
            >
              {summary.sub}
            </motion.p>

            {isOwn && !hasRoom && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[11px] text-muted-foreground/50 mt-2 italic"
              >
                Previewing your challenge link
              </motion.p>
            )}
          </motion.div>

          {/* Tab switcher */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center gap-1 mb-5"
          >
            {tabs.filter(t => t.show).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-display font-semibold uppercase tracking-[0.08em] transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </motion.div>

          {/* Personal comparison view */}
          {activeTab === 'personal' && (
            <div className="space-y-3 mb-6">
              {results.map((r, i) => (
                <motion.div
                  key={r.prompt.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
                  className={`rounded-xl border-2 overflow-hidden transition-colors ${
                    r.matched
                      ? 'border-[hsl(var(--match-best)/0.3)] bg-[hsl(var(--match-best)/0.04)]'
                      : 'border-border/60 bg-card'
                  }`}
                >
                  <div className="px-4 pt-3 pb-2">
                    <PromptPair wordA={r.prompt.word_a} wordB={r.prompt.word_b} size="sm" />
                  </div>
                  <div className="px-4 pb-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-display mb-1">You</p>
                        <p className={`font-display font-bold text-lg break-words ${
                          r.matched ? 'text-[hsl(var(--match-best))]' : 'text-foreground'
                        }`}>
                          {r.recipientAnswer?.raw_answer ?? '—'}
                        </p>
                      </div>
                      <div className="w-px h-8 bg-border/40" />
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-display mb-1">
                          {isOwn ? 'Your answer' : 'Friend'}
                        </p>
                        <p className={`font-display font-bold text-lg break-words ${
                          r.matched ? 'text-[hsl(var(--match-best))]' : 'text-foreground/60'
                        }`}>
                          {r.challengerAnswer.raw_answer}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-center">
                      {r.matched ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 300 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--match-best)/0.1)]"
                        >
                          <Zap className="h-3 w-3 text-[hsl(var(--match-best))]" />
                          <span className="text-[11px] font-display font-bold text-[hsl(var(--match-best))] uppercase tracking-[0.1em]">JINX</span>
                        </motion.div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50">
                          <X className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-[11px] font-display font-medium text-muted-foreground/50 tracking-tight">No match</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Room view */}
          {activeTab === 'room' && (
            <div className="mb-6">
              <RoomResults results={roomResults} participants={participants} />
            </div>
          )}

          {/* Crowd view - link to archive */}
          {activeTab === 'crowd' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 space-y-4 mb-6"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 mb-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                  Global results
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                See how the wider crowd answered today's prompts.
              </p>
              <Button variant="outline" className="rounded-xl" asChild>
                <Link to="/archive">View crowd results <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
              </Button>
            </motion.div>
          )}

          {/* Social Memory */}
          <div className="mb-4">
            <SocialMemoryCard refreshKey={socialRefreshKey} compact />
          </div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-2.5"
          >
            <Button
              onClick={handleShareResult}
              className="w-full rounded-xl h-11 font-semibold text-sm active:scale-[0.97] transition-transform"
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Share this result
            </Button>

            <Button
              onClick={handleShareChallenge}
              variant="outline"
              className="w-full rounded-xl h-10 text-sm active:scale-[0.97] transition-transform"
            >
              <Share2 className="h-3.5 w-3.5 mr-2" /> Invite more friends
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-xl h-9 text-xs text-muted-foreground"
              asChild
            >
              <Link to="/">
                <Home className="h-3 w-3 mr-1.5" /> Back home
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-border py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground/30 tracking-wide">JINX — daily crowd word game</p>
      </footer>
    </div>
  );
}
