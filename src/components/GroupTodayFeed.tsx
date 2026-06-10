import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import PromptPair from './PromptPair';
import { getPlayerId } from '@/lib/store';
import type { GroupDayResult } from '@/lib/groups';

interface Props {
  results: GroupDayResult[];
  inviteCode: string;
  viewerPlayed: boolean;
}

/**
 * Result-led "Today" feed for a group.
 * - Each prompt with ≥2 matched members → celebratory hero strip
 * - Each prompt with answers but no jinx → quiet "N unique answers" tile (expandable)
 * - Each prompt with no answers yet → muted placeholder
 * - Whole feed blurred + locked when viewer hasn't played today
 */
export default function GroupTodayFeed({ results, inviteCode, viewerPlayed }: Props) {
  const myId = getPlayerId();

  return (
    <div className={`relative space-y-[10px] ${viewerPlayed ? '' : 'select-none'}`}>
      <div className={viewerPlayed ? '' : 'blur-[6px] pointer-events-none'}>
        {results.map((r, i) => (
          <PromptRow
            key={r.prompt_id}
            result={r}
            inviteCode={inviteCode}
            myId={myId}
            index={i}
          />
        ))}
      </div>

      {!viewerPlayed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/95 border border-border/60 px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
            <EyeOff className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
              Play to reveal
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PromptRow({
  result,
  inviteCode,
  myId,
  index,
}: {
  result: GroupDayResult;
  inviteCode: string;
  myId: string;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const myAnswer = result.answers.find(a => a.session_id === myId);
  const myName = myAnswer?.display_name ?? 'You';

  // Find the biggest cluster
  const topCluster = result.clusters[0];
  const isJinx = !!topCluster && topCluster.members.length >= 2;
  const totalAnswers = result.answers.length;
  const uniqueCount = result.clusters.length;

  // Map display_name → session_id for chip linking
  const nameToSid = new Map(result.answers.map(a => [a.display_name, a.session_id]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-[12px] border overflow-hidden ${
        isJinx
          ? 'border-primary/25 bg-primary/[0.03]'
          : 'border-border/50 bg-card'
      }`}
    >
      {/* Prompt header */}
      <div className="px-[12px] pt-[10px] pb-[6px]">
        <PromptPair wordA={result.word_a} wordB={result.word_b} size="sm" />
      </div>

      {totalAnswers === 0 ? (
        <div className="px-[12px] pb-[10px]">
          <p className="text-[11px] text-muted-foreground/50 italic">No answers yet</p>
        </div>
      ) : isJinx ? (
        <>
          <JinxHero
            cluster={topCluster}
            myName={myName}
            nameToSid={nameToSid}
            inviteCode={inviteCode}
            myId={myId}
          />
          {result.clusters.length > 1 && (
            <UniqueTile
              totalAnswers={totalAnswers}
              uniqueCount={uniqueCount - 1}
              clusters={result.clusters.slice(1)}
              myName={myName}
              nameToSid={nameToSid}
              inviteCode={inviteCode}
              myId={myId}
              expanded={expanded}
              onToggle={() => setExpanded(v => !v)}
              variant="other"
            />
          )}
        </>
      ) : (
        <UniqueTile
          totalAnswers={totalAnswers}
          uniqueCount={uniqueCount}
          clusters={result.clusters}
          myName={myName}
          nameToSid={nameToSid}
          inviteCode={inviteCode}
          myId={myId}
          expanded={expanded}
          onToggle={() => setExpanded(v => !v)}
        />
      )}
    </motion.div>
  );
}

function JinxHero({
  cluster,
  myName,
  nameToSid,
  inviteCode,
  myId,
}: {
  cluster: { answer: string; members: string[]; variants?: { name: string; raw: string; normalized: string }[] };
  myName: string;
  nameToSid: Map<string, string>;
  inviteCode: string;
  myId: string;
}) {
  const includesMe = cluster.members.includes(myName);
  const variants = cluster.variants ?? [];
  const uniqueNorms = new Set(variants.map(v => v.normalized));
  const showVariants = variants.length >= 2 && uniqueNorms.size >= 2;

  return (
    <div className="px-[12px] pb-[12px]">
      <div className="rounded-[10px] bg-primary/8 border border-primary/20 px-[12px] py-[10px]">
        <div className="flex items-center gap-[6px] mb-[6px]">
          <Zap className="h-[12px] w-[12px] text-primary" fill="currentColor" />
          <span className="text-[9px] font-bold text-primary uppercase tracking-[0.1em]">
            {includesMe ? 'You jinxed' : 'Jinx'}
          </span>
        </div>
        {showVariants ? (
          <div className="space-y-[6px]">
            {variants.map((v, i) => {
              const isMe = v.name === myName;
              return (
                <div key={`${v.name}-${i}`} className="flex items-center justify-between gap-[8px]">
                  <p className="text-[18px] font-display font-bold text-foreground leading-tight break-words min-w-0">
                    {v.raw}
                  </p>
                  <MemberChip
                    name={v.name}
                    sid={nameToSid.get(v.name)}
                    inviteCode={inviteCode}
                    isMe={isMe}
                    myId={myId}
                    tone="strong"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <p className="text-[18px] font-display font-bold text-foreground leading-tight break-words mb-[8px]">
              {cluster.answer}
            </p>
            <div className="flex flex-wrap gap-[5px]">
              {cluster.members.map(name => (
                <MemberChip
                  key={name}
                  name={name}
                  sid={nameToSid.get(name)}
                  inviteCode={inviteCode}
                  isMe={name === myName}
                  myId={myId}
                  tone="strong"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UniqueTile({
  totalAnswers,
  uniqueCount,
  clusters,
  myName,
  nameToSid,
  inviteCode,
  myId,
  expanded,
  onToggle,
  variant,
}: {
  totalAnswers: number;
  uniqueCount: number;
  clusters: { answer: string; members: string[] }[];
  myName: string;
  nameToSid: Map<string, string>;
  inviteCode: string;
  myId: string;
  expanded: boolean;
  onToggle: () => void;
  variant?: 'other';
}) {
  const label = variant === 'other'
    ? <>see <span className="font-semibold text-foreground">{uniqueCount}</span> other {uniqueCount === 1 ? 'answer' : 'answers'}</>
    : <><span className="font-semibold text-foreground">{uniqueCount}</span> unique {uniqueCount === 1 ? 'answer' : 'answers'}<span className="text-muted-foreground/40"> · {totalAnswers} played · no jinxes</span></>;
  return (
    <div className="px-[12px] pb-[10px]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left rounded-[8px] hover:bg-muted/30 transition-colors py-[4px] -mx-[2px] px-[6px]"
      >
        <span className="text-[12px] text-muted-foreground">{label}</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        )}
      </button>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-[8px] space-y-[5px]"
        >
          {clusters.map(c => {
            const member = c.members[0];
            const isMe = member === myName;
            return (
              <div
                key={c.answer}
                className="flex items-center justify-between px-[10px] py-[6px] rounded-[8px] bg-muted/40"
              >
                <span className={`text-[13px] font-display font-semibold truncate ${
                  isMe ? 'text-foreground' : 'text-foreground/75'
                }`}>
                  {c.answer}
                </span>
                <MemberChip
                  name={member}
                  sid={nameToSid.get(member)}
                  inviteCode={inviteCode}
                  isMe={isMe}
                  myId={myId}
                  tone="muted"
                />
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function MemberChip({
  name,
  sid,
  inviteCode,
  isMe,
  myId,
  tone,
}: {
  name: string;
  sid: string | undefined;
  inviteCode: string;
  isMe: boolean;
  myId: string;
  tone: 'strong' | 'muted';
}) {
  const cls =
    tone === 'strong'
      ? isMe
        ? 'bg-primary text-primary-foreground'
        : 'bg-primary/15 text-primary hover:bg-primary/25'
      : isMe
      ? 'bg-primary/15 text-primary'
      : 'bg-background border border-border/60 text-foreground/70 hover:bg-muted';

  const base = `text-[10px] px-[8px] py-[3px] rounded-full font-display font-bold transition-colors`;

  // Don't link self to self
  if (isMe || !sid || sid === myId) {
    return <span className={`${base} ${cls}`}>{name}{isMe ? ' (you)' : ''}</span>;
  }

  return (
    <Link
      to={`/g/${inviteCode}/pair/${sid}`}
      className={`${base} ${cls}`}
    >
      {name}
    </Link>
  );
}
