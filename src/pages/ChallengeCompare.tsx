import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, X, ArrowRight, Share2, Loader2, AlertCircle, Home, Copy, Users, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PromptPair from '@/components/PromptPair';
import JinxLogo from '@/components/JinxLogo';
import PlayerIdentity from '@/components/PlayerIdentity';
import RoomResults from '@/components/RoomResults';
import SocialMemoryCard from '@/components/SocialMemoryCard';
import { recordMatchesForChallenge } from '@/lib/social-memory';
import {
  getChallengeByToken,
  getPromptsForDate,
  compareAnswers,
  buildChallengeShareText,
  isChallenger,
  type Challenge,
  type ComparisonResult,
  type ChallengeAnswer,
} from '@/lib/challenge';
import { getRoomParticipants, getRoomResults, joinChallengeRoom, getDisplayName, type RoomParticipant, type RoomPromptResult } from '@/lib/challenge-room';
import { getCompletedPrompts, getPlayerId, getUserAnswer } from '@/lib/store';
import { normalizeAnswer } from '@/lib/normalize';
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

/** Build comparison results against a specific participant's answers */
async function compareAgainstParticipant(
  participantSessionId: string,
  prompts: DbPrompt[],
  challengeAnswers: ChallengeAnswer[],
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];

  for (const prompt of prompts) {
    const challengerAnswer = challengeAnswers.find(a => a.prompt_id === prompt.id);
    if (!challengerAnswer) continue;

    // Get the participant's answer from the DB
    const { data } = await supabase
      .from('answers')
      .select('raw_answer, normalized_answer')
      .eq('prompt_id', prompt.id)
      .eq('session_id', participantSessionId)
      .maybeSingle();

    const matched = data ? normalizeAnswer(data.raw_answer) === challengerAnswer.normalized_answer : false;

    results.push({
      prompt,
      challengerAnswer,
      recipientAnswer: data ? { raw_answer: data.raw_answer, normalized_answer: data.normalized_answer } : null,
      matched,
    });
  }
  return results;
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
  const [selectedParticipant, setSelectedParticipant] = useState<RoomParticipant | null>(null);
  const [isOwn, setIsOwn] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }

    (async () => {
      try {
        const ch = await getChallengeByToken(token);
        if (!ch) { setError('Challenge not found'); setLoading(false); return; }
        setChallenge(ch);

        const own = isChallenger(ch);
        setIsOwn(own);

        const ps = await getPromptsForDate(ch.date);
        if (ps.length === 0) { setError('Prompts not available'); setLoading(false); return; }
        setPrompts(ps);

        const completed = getCompletedPrompts();
        const allPlayed = ps.every(p => completed.has(p.id));

        if (!allPlayed && !own) {
          navigate(`/c/${token}`, { replace: true });
          return;
        }

        // Ensure participant record exists
        const savedName = getDisplayName();
        if (savedName) {
          try { await joinChallengeRoom(ch.id, savedName); } catch { /* ok */ }
        }

        // Load room data
        const [parts, room] = await Promise.all([
          getRoomParticipants(ch.id),
          getRoomResults(ch.id, ps.map(p => p.id)),
        ]);

        setParticipants(parts);
        setRoomResults(room);

        const myId = getPlayerId();
        const others = parts.filter(p => p.session_id !== myId);

        if (own) {
          // Creator: default to room tab always
          setActiveTab('room');

          // If exactly one other participant, auto-select for VS FRIEND
          if (others.length === 1) {
            const comparison = await compareAgainstParticipant(others[0].session_id, ps, ch.answers);
            setResults(comparison);
            setSelectedParticipant(others[0]);
          }
          // If multiple others, don't auto-compare — user picks from room
        } else {
          // Invited participant: compare against challenger
          const comparison = await compareAnswers(ch, ps);
          setResults(comparison);
          setActiveTab('personal');
        }

        // Record match history if room has multiple participants
        if (parts.length >= 2) {
          recordMatchesForChallenge(ch.id).catch(() => {});
        }

        setLoading(false);
      } catch {
        setError('Something went wrong');
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  // Handle selecting a participant to compare against (for creator)
  const handleSelectParticipant = useCallback(async (participant: RoomParticipant) => {
    if (!challenge || prompts.length === 0) return;
    setSelectedParticipant(participant);
    const comparison = await compareAgainstParticipant(participant.session_id, prompts, challenge.answers);
    setResults(comparison);
    setActiveTab('personal');
  }, [challenge, prompts]);

  // Realtime: listen for new participants joining the room
  const refreshRoom = useCallback(async () => {
    if (!challenge || prompts.length === 0) return;
    const [parts, room] = await Promise.all([
      getRoomParticipants(challenge.id),
      getRoomResults(challenge.id, prompts.map(p => p.id)),
    ]);
    setParticipants(parts);
    setRoomResults(room);

    // Auto-select if creator now has exactly one other and none selected
    const myId = getPlayerId();
    const others = parts.filter(p => p.session_id !== myId);
    if (isOwn && others.length === 1 && !selectedParticipant) {
      const comparison = await compareAgainstParticipant(others[0].session_id, prompts, challenge.answers);
      setResults(comparison);
      setSelectedParticipant(others[0]);
    }
  }, [challenge, prompts, isOwn, selectedParticipant]);

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

  const myId = getPlayerId();
  const otherParticipants = participants.filter(p => p.session_id !== myId);
  const hasOthers = otherParticipants.length > 0;
  const hasRoom = participants.length >= 2;

  // Creator state detection
  const creatorWaiting = isOwn && !hasOthers;
  const creatorWithRoom = isOwn && hasOthers;
  const hasValidComparison = !isOwn || (isOwn && selectedParticipant !== null);

  const matchCount = results.filter(r => r.matched).length;
  const total = results.length;
  const summary = getSummary(matchCount, total);

  const today = new Date().toISOString().split('T')[0];
  const isToday = challenge.date === today;
  const dateLabel = isToday
    ? "Today's JINX"
    : new Date(challenge.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // Contextual summary
  const getSummaryContent = () => {
    if (creatorWaiting) {
      return { emoji: '📡', headline: 'Your room is live', sub: 'Waiting for friends to join…', tone: 'waiting' as const };
    }
    if (creatorWithRoom && activeTab === 'room') {
      return {
        emoji: '👥',
        headline: `${otherParticipants.length} ${otherParticipants.length === 1 ? 'friend' : 'friends'} joined`,
        sub: 'See what everyone said',
        tone: 'room' as const,
      };
    }
    if (hasValidComparison && activeTab === 'personal') {
      return { ...summary };
    }
    if (creatorWithRoom) {
      return {
        emoji: '👥',
        headline: `${otherParticipants.length} ${otherParticipants.length === 1 ? 'friend' : 'friends'} joined`,
        sub: 'Tap a name to compare',
        tone: 'room' as const,
      };
    }
    return { ...summary };
  };

  const summaryContent = getSummaryContent();

  const handleShareResult = async () => {
    if (!hasValidComparison) {
      // Share room info instead
      const text = buildChallengeShareText(prompts, challenge.token);
      if (navigator.share) {
        try { await navigator.share({ text }); return; } catch { /* fallback */ }
      }
      await navigator.clipboard.writeText(text);
      toast({ title: 'Challenge copied!', description: 'Share it with your friends' });
      return;
    }
    const compareName = selectedParticipant?.display_name ?? 'Friend';
    const lines = results.map(r => {
      const icon = r.matched ? '🟩' : '⬜';
      return `${icon} ${r.prompt.word_a.toUpperCase()} + ${r.prompt.word_b.toUpperCase()}`;
    });
    const header = hasRoom
      ? `⚡ JINX Challenge (${participants.length} players)\nMatched ${matchCount}/${total} with ${compareName}`
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

  // Tab visibility rules
  const showVsFriend = !creatorWaiting && (hasValidComparison || (!isOwn));
  const tabs: { key: ViewTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'personal', label: selectedParticipant ? `vs ${selectedParticipant.display_name}` : 'vs Friend', icon: <Zap className="h-3 w-3" />, show: showVsFriend },
    { key: 'room', label: 'Room', icon: <Users className="h-3 w-3" />, show: true },
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
              {summaryContent.emoji}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`font-display font-black text-2xl tracking-tight mb-1 ${
                summaryContent.tone === 'best' ? 'text-[hsl(var(--match-best))]' :
                summaryContent.tone === 'strong' ? 'text-[hsl(var(--match-strong))]' :
                summaryContent.tone === 'decent' ? 'text-[hsl(var(--match-good))]' :
                summaryContent.tone === 'waiting' || summaryContent.tone === 'room' ? 'text-primary' :
                'text-foreground'
              }`}
            >
              {summaryContent.headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-sm text-muted-foreground"
            >
              {summaryContent.sub}
            </motion.p>

            {creatorWaiting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10"
              >
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[11px] font-display font-semibold text-primary uppercase tracking-[0.08em]">Live</span>
              </motion.div>
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

          {/* Personal comparison view — only when there's a real comparison */}
          {activeTab === 'personal' && hasValidComparison && (
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
                          {isOwn ? r.challengerAnswer.raw_answer : (r.recipientAnswer?.raw_answer ?? '—')}
                        </p>
                      </div>
                      <div className="w-px h-8 bg-border/40" />
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-display mb-1">
                          {selectedParticipant?.display_name ?? 'Friend'}
                        </p>
                        <p className={`font-display font-bold text-lg break-words ${
                          r.matched ? 'text-[hsl(var(--match-best))]' : 'text-foreground/60'
                        }`}>
                          {isOwn ? (r.recipientAnswer?.raw_answer ?? '—') : r.challengerAnswer.raw_answer}
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
              {creatorWaiting ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-10 space-y-4"
                >
                  <div className="text-4xl mb-2">📨</div>
                  <p className="text-sm text-muted-foreground">
                    Share your link and answers will appear here in real time.
                  </p>
                  <Button
                    onClick={handleShareChallenge}
                    className="rounded-xl h-10 text-sm"
                  >
                    <Share2 className="h-3.5 w-3.5 mr-2" /> Send to your group
                  </Button>
                </motion.div>
              ) : (
                <>
                  <RoomResults results={roomResults} participants={participants} />
                  {/* Participant picker for creator to compare against */}
                  {isOwn && otherParticipants.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50"
                    >
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-display mb-2">Compare against</p>
                      <div className="flex flex-wrap gap-1.5">
                        {otherParticipants.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectParticipant(p)}
                            className={`px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-all ${
                              selectedParticipant?.id === p.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {p.display_name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
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
            <SocialMemoryCard compact />
          </div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-2.5"
          >
            {hasValidComparison && (
              <Button
                onClick={handleShareResult}
                className="w-full rounded-xl h-11 font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                <Copy className="h-3.5 w-3.5 mr-2" /> Share this result
              </Button>
            )}

            <Button
              onClick={handleShareChallenge}
              variant={hasValidComparison ? 'outline' : 'default'}
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
