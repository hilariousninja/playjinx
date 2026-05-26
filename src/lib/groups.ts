import { supabase } from '@/integrations/supabase/client';
import { getPlayerId } from './store';
import { getDisplayName } from './challenge-room';

const MY_GROUPS_KEY = 'jinx_my_groups';

// --- Types ---

export interface JinxGroup {
  id: string;
  name: string;
  invite_code: string;
  creator_session_id: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  session_id: string;
  display_name: string;
  active: boolean;
  joined_at: string;
}

export interface GroupTodayHeadline {
  promptId: string | null;
  word_a: string | null;
  word_b: string | null;
  jinxAnswer: string | null;        // raw answer text when ≥2 members matched
  jinxNames: [string, string] | null;
  viewerPlayed: boolean;
  answeredCount: number;
  totalMembers: number;
  hasJinxToday: boolean;
}

export interface GroupWithActivity extends JinxGroup {
  memberCount: number;
  hasActivityToday: boolean;
  todayAnsweredCount: number;
  todayHeadline: GroupTodayHeadline | null;
  viewerPlayedToday: boolean;
}

// --- Local tracking (supplement DB) ---

function getLocalGroupIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MY_GROUPS_KEY) || '[]');
  } catch { return []; }
}

function addLocalGroupId(groupId: string) {
  const ids = getLocalGroupIds();
  if (!ids.includes(groupId)) {
    ids.push(groupId);
    localStorage.setItem(MY_GROUPS_KEY, JSON.stringify(ids));
  }
}

function removeLocalGroupId(groupId: string) {
  const ids = getLocalGroupIds().filter(id => id !== groupId);
  localStorage.setItem(MY_GROUPS_KEY, JSON.stringify(ids));
}

// --- Invite code generation ---

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')           // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')    // non-alnum → dash
    .replace(/^-+|-+$/g, '')        // trim leading/trailing dashes
    .slice(0, 30);                   // cap length
}

function shortSuffix(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function generateInviteCode(groupName: string): string {
  const slug = slugify(groupName);
  if (!slug) return shortSuffix();
  return `${slug}-${shortSuffix()}`;
}

// --- Group CRUD ---

export async function createGroup(name: string): Promise<JinxGroup> {
  const sessionId = getPlayerId();
  const inviteCode = generateInviteCode(name);

  const { data, error } = await supabase
    .from('groups')
    .insert({ name: name.trim() || 'My JINX group', invite_code: inviteCode, creator_session_id: sessionId })
    .select()
    .single();

  if (error) throw error;
  const group = data as JinxGroup;

  // Auto-join as creator
  const displayName = getDisplayName() || 'Player';
  await joinGroup(group.id, displayName);
  addLocalGroupId(group.id);

  return group;
}

export async function getGroupByInviteCode(code: string): Promise<JinxGroup | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();

  if (error) throw error;
  return data as JinxGroup | null;
}

export async function getGroupById(id: string): Promise<JinxGroup | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as JinxGroup | null;
}

// --- Membership ---

export async function joinGroup(groupId: string, displayName: string): Promise<GroupMember> {
  const sessionId = getPlayerId();

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    // Reactivate if inactive, update name if changed
    if (!existing.active || existing.display_name !== displayName) {
      const { data, error } = await supabase
        .from('group_members')
        .update({ active: true, display_name: displayName })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      addLocalGroupId(groupId);
      return data as GroupMember;
    }
    addLocalGroupId(groupId);
    return existing as GroupMember;
  }

  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, session_id: sessionId, display_name: displayName })
    .select()
    .single();

  if (error) throw error;
  addLocalGroupId(groupId);
  return data as GroupMember;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const sessionId = getPlayerId();
  await supabase
    .from('group_members')
    .update({ active: false })
    .eq('group_id', groupId)
    .eq('session_id', sessionId);
  removeLocalGroupId(groupId);
}

export async function isMemberOf(groupId: string): Promise<boolean> {
  const sessionId = getPlayerId();
  const { data } = await supabase
    .from('group_members')
    .select('id, active')
    .eq('group_id', groupId)
    .eq('session_id', sessionId)
    .maybeSingle();
  return !!(data && data.active);
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('active', true)
    .order('joined_at');

  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

// --- My Groups ---

export async function getMyGroups(): Promise<GroupWithActivity[]> {
  const sessionId = getPlayerId();
  const today = new Date().toISOString().slice(0, 10);

  // Get groups where I'm an active member
  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('session_id', sessionId)
    .eq('active', true);

  if (error || !memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  // Fetch group details
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds);

  if (!groups) return [];

  // Get today's prompts for activity check
  const { data: todayPrompts } = await supabase
    .from('prompts')
    .select('id')
    .eq('date', today)
    .in('mode', ['daily', 'archive']);

  const promptIds = (todayPrompts ?? []).map(p => p.id);

  // For each group, get member count and today activity
  const result: GroupWithActivity[] = await Promise.all(
    (groups as JinxGroup[]).map(async (g) => {
      const { data: members } = await supabase
        .from('group_members')
        .select('session_id')
        .eq('group_id', g.id)
        .eq('active', true);

      const memberSessionIds = (members ?? []).map(m => m.session_id);
      const memberCount = memberSessionIds.length;

      let hasActivityToday = false;
      let todayAnsweredCount = 0;

      if (promptIds.length > 0 && memberSessionIds.length > 0) {
        const { data: answers } = await supabase
          .from('answers')
          .select('session_id')
          .in('prompt_id', promptIds)
          .in('session_id', memberSessionIds);

        const uniqueAnswered = new Set((answers ?? []).map(a => a.session_id));
        todayAnsweredCount = uniqueAnswered.size;
        // Has activity if someone other than me answered
        hasActivityToday = uniqueAnswered.size > 1 || (uniqueAnswered.size === 1 && !uniqueAnswered.has(sessionId));
      }

      return { ...g, memberCount, hasActivityToday, todayAnsweredCount };
    })
  );

  // Sort: most recently active first
  return result.sort((a, b) => {
    if (a.hasActivityToday && !b.hasActivityToday) return -1;
    if (!a.hasActivityToday && b.hasActivityToday) return 1;
    return b.memberCount - a.memberCount;
  });
}

// --- Group Results ---

export interface GroupDayResult {
  prompt_id: string;
  word_a: string;
  word_b: string;
  answers: { session_id: string; display_name: string; raw_answer: string; normalized_answer: string }[];
  clusters: { answer: string; members: string[] }[];
}

export async function getGroupDayResults(groupId: string, date?: string): Promise<GroupDayResult[]> {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  // Get active members
  const members = await getGroupMembers(groupId);
  if (members.length === 0) return [];

  const sessionIds = members.map(m => m.session_id);
  const nameMap = new Map(members.map(m => [m.session_id, m.display_name]));

  // Get today's prompts
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, word_a, word_b')
    .eq('date', targetDate)
    .in('mode', ['daily', 'archive'])
    .order('created_at')
    .limit(3);

  if (!prompts || prompts.length === 0) return [];

  const promptIds = prompts.map(p => p.id);

  // Get answers
  const { data: answers } = await supabase
    .from('answers')
    .select('prompt_id, session_id, raw_answer, normalized_answer')
    .in('prompt_id', promptIds)
    .in('session_id', sessionIds);

  return prompts.map(prompt => {
    const promptAnswers = (answers ?? [])
      .filter(a => a.prompt_id === prompt.id)
      .map(a => ({
        session_id: a.session_id,
        display_name: nameMap.get(a.session_id) ?? 'Unknown',
        raw_answer: a.raw_answer,
        normalized_answer: a.normalized_answer,
      }));

    const clusterMap = new Map<string, string[]>();
    for (const a of promptAnswers) {
      const existing = clusterMap.get(a.normalized_answer) ?? [];
      existing.push(a.display_name);
      clusterMap.set(a.normalized_answer, existing);
    }

    const clusters = Array.from(clusterMap.entries())
      .map(([answer, members]) => ({ answer, members }))
      .sort((a, b) => b.members.length - a.members.length);

    return {
      prompt_id: prompt.id,
      word_a: prompt.word_a,
      word_b: prompt.word_b,
      answers: promptAnswers,
      clusters,
    };
  });
}

// --- Group History ---

export interface GroupDayPromptDetail {
  prompt_id: string;
  word_a: string;
  word_b: string;
  clusters: { answer: string; members: string[] }[];
  answeredMembers: string[]; // display names
}

export interface GroupDaySnapshot {
  date: string;
  promptCount: number;
  answeredCount: number;
  memberCount: number;
  jinxPairs: { memberA: string; memberB: string; answer: string; word_a: string; word_b: string }[];
  totalJinxes: number;
  prompts: GroupDayPromptDetail[];
}

export interface GroupMemberStats {
  session_id: string;
  display_name: string;
  totalJinxes: number;
  daysPlayed: number;
}

export interface GroupHistoryData {
  days: GroupDaySnapshot[];
  memberStats: GroupMemberStats[];
  totalDaysActive: number;
  bestPair: { nameA: string; nameB: string; jinxCount: number } | null;
  hasMore: boolean;
  oldestLoadedDate: string | null;
  /** Dates (YYYY-MM-DD) on which the current player answered at least one prompt. Used to gate per-day reveal. */
  myAnsweredDates: string[];
}

/**
 * Compute all-time aggregate stats (member leaderboard + best pair + total active days) for a group.
 * Independent of the visible day window so totals don't shrink as user paginates.
 */
async function computeGroupLifetimeStats(
  sessionIds: string[],
  nameMap: Map<string, string>
): Promise<{
  memberStats: GroupMemberStats[];
  bestPair: GroupHistoryData['bestPair'];
  totalDaysActive: number;
}> {
  if (sessionIds.length === 0) {
    return { memberStats: [], bestPair: null, totalDaysActive: 0 };
  }

  // Pull every daily/archive prompt ever (id + date)
  const { data: allPrompts } = await supabase
    .from('prompts')
    .select('id, date')
    .in('mode', ['daily', 'archive']);

  if (!allPrompts || allPrompts.length === 0) {
    return { memberStats: [], bestPair: null, totalDaysActive: 0 };
  }

  const promptDateMap = new Map<string, string>();
  for (const p of allPrompts) promptDateMap.set(p.id, p.date);

  // Pull every answer this group has ever given. Chunk in case promptIds is large.
  const promptIds = allPrompts.map(p => p.id);
  const allAnswers: { prompt_id: string; session_id: string; normalized_answer: string }[] = [];
  const CHUNK = 500;
  for (let i = 0; i < promptIds.length; i += CHUNK) {
    const slice = promptIds.slice(i, i + CHUNK);
    const { data } = await supabase
      .from('answers')
      .select('prompt_id, session_id, normalized_answer')
      .in('prompt_id', slice)
      .in('session_id', sessionIds);
    if (data) allAnswers.push(...data);
  }

  // Bucket answers by date+prompt
  const byDatePrompt = new Map<string, Map<string, Map<string, string>>>(); // date -> prompt_id -> session_id -> normalized
  const memberDays = new Map<string, Set<string>>();
  for (const a of allAnswers) {
    const date = promptDateMap.get(a.prompt_id);
    if (!date) continue;
    if (!byDatePrompt.has(date)) byDatePrompt.set(date, new Map());
    const promptBucket = byDatePrompt.get(date)!;
    if (!promptBucket.has(a.prompt_id)) promptBucket.set(a.prompt_id, new Map());
    promptBucket.get(a.prompt_id)!.set(a.session_id, a.normalized_answer);
    if (!memberDays.has(a.session_id)) memberDays.set(a.session_id, new Set());
    memberDays.get(a.session_id)!.add(date);
  }

  const pairJinxes = new Map<string, { nameA: string; nameB: string; count: number }>();
  const memberJinxTotals = new Map<string, number>();

  for (const [, promptBucket] of byDatePrompt) {
    for (const [, sessionMap] of promptBucket) {
      const entries = Array.from(sessionMap.entries());
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[i][1] === entries[j][1]) {
            const sidA = entries[i][0];
            const sidB = entries[j][0];
            const nameA = nameMap.get(sidA) ?? 'Unknown';
            const nameB = nameMap.get(sidB) ?? 'Unknown';
            const pairKey = [sidA, sidB].sort().join(':');
            const existing = pairJinxes.get(pairKey) ?? { nameA, nameB, count: 0 };
            existing.count++;
            pairJinxes.set(pairKey, existing);
            memberJinxTotals.set(sidA, (memberJinxTotals.get(sidA) ?? 0) + 1);
            memberJinxTotals.set(sidB, (memberJinxTotals.get(sidB) ?? 0) + 1);
          }
        }
      }
    }
  }

  const memberStats: GroupMemberStats[] = sessionIds.map(sid => ({
    session_id: sid,
    display_name: nameMap.get(sid) ?? 'Unknown',
    totalJinxes: memberJinxTotals.get(sid) ?? 0,
    daysPlayed: memberDays.get(sid)?.size ?? 0,
  })).sort((a, b) => b.totalJinxes - a.totalJinxes || b.daysPlayed - a.daysPlayed);

  const bestPairEntry = Array.from(pairJinxes.values()).sort((a, b) => b.count - a.count)[0] ?? null;
  const bestPair = bestPairEntry
    ? { nameA: bestPairEntry.nameA, nameB: bestPairEntry.nameB, jinxCount: bestPairEntry.count }
    : null;

  // Total distinct days where ANY group member played
  const allDays = new Set<string>();
  for (const days of memberDays.values()) for (const d of days) allDays.add(d);

  return { memberStats, bestPair, totalDaysActive: allDays.size };
}

/**
 * Load group history.
 * - `daysWindow`: how many days back from `before` to include (default 14)
 * - `before`: load days strictly before this date (defaults to today)
 */
export async function getGroupHistory(
  groupId: string,
  options: { daysWindow?: number; before?: string } = {}
): Promise<GroupHistoryData> {
  const daysWindow = options.daysWindow ?? 14;
  const members = await getGroupMembers(groupId);
  const empty = (extra: Partial<GroupHistoryData> = {}): GroupHistoryData => ({
    days: [], memberStats: [], totalDaysActive: 0, bestPair: null,
    hasMore: false, oldestLoadedDate: null, myAnsweredDates: [], ...extra,
  });
  if (members.length === 0) return empty();

  const sessionIds = members.map(m => m.session_id);
  const nameMap = new Map(members.map(m => [m.session_id, m.display_name]));
  const today = new Date().toISOString().slice(0, 10);
  const beforeDate = options.before ?? today;
  const mySessionId = getPlayerId();

  // Compute window start
  const beforeMs = new Date(beforeDate + 'T12:00:00').getTime();
  const windowStart = new Date(beforeMs - daysWindow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // All-time aggregate stats (independent of visible window) + the window batch in parallel
  const [lifetime, promptsRes, olderProbeRes] = await Promise.all([
    computeGroupLifetimeStats(sessionIds, nameMap),
    supabase
      .from('prompts')
      .select('id, word_a, word_b, date')
      .in('mode', ['daily', 'archive'])
      .gte('date', windowStart)
      .lt('date', beforeDate)
      .order('date', { ascending: false }),
    supabase
      .from('prompts')
      .select('date')
      .in('mode', ['daily', 'archive'])
      .lt('date', windowStart)
      .order('date', { ascending: false })
      .limit(1),
  ]);

  const prompts = promptsRes.data;
  const hasMore = !!(olderProbeRes.data && olderProbeRes.data.length > 0);

  // Compute the current player's answered dates across ALL time, so reveal gating
  // works for older days too (not just the visible window).
  const { data: myAnswersAllTime } = await supabase
    .from('answers')
    .select('prompt_id')
    .eq('session_id', mySessionId);
  const myPromptIds = new Set((myAnswersAllTime ?? []).map(a => a.prompt_id));
  // Resolve prompt -> date map for those answers
  const myDateSet = new Set<string>();
  if (myPromptIds.size > 0) {
    const ids = Array.from(myPromptIds);
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data } = await supabase
        .from('prompts')
        .select('date')
        .in('id', slice)
        .in('mode', ['daily', 'archive']);
      for (const r of data ?? []) myDateSet.add(r.date);
    }
  }
  const myAnsweredDates = Array.from(myDateSet);

  if (!prompts || prompts.length === 0) {
    return {
      ...empty(),
      memberStats: lifetime.memberStats,
      bestPair: lifetime.bestPair,
      totalDaysActive: lifetime.totalDaysActive,
      hasMore,
      oldestLoadedDate: windowStart,
      myAnsweredDates,
    };
  }

  const promptIds = prompts.map(p => p.id);

  // Get answers from group members for these prompts (windowed, for day cards)
  const { data: answers } = await supabase
    .from('answers')
    .select('prompt_id, session_id, raw_answer, normalized_answer')
    .in('prompt_id', promptIds)
    .in('session_id', sessionIds);

  // Group prompts by date
  const promptsByDate = new Map<string, typeof prompts>();
  for (const p of prompts) {
    const list = promptsByDate.get(p.date) ?? [];
    list.push(p);
    promptsByDate.set(p.date, list);
  }

  // Build answer lookup: prompt_id -> session_id -> { raw, normalized }
  const answerMap = new Map<string, Map<string, { raw: string; normalized: string }>>();
  for (const a of (answers ?? [])) {
    if (!answerMap.has(a.prompt_id)) answerMap.set(a.prompt_id, new Map());
    answerMap.get(a.prompt_id)!.set(a.session_id, { raw: a.raw_answer, normalized: a.normalized_answer });
  }

  const days: GroupDaySnapshot[] = [];

  for (const [date, dayPrompts] of promptsByDate) {
    const jinxPairs: GroupDaySnapshot['jinxPairs'] = [];
    const answeredSessions = new Set<string>();
    const promptDetails: GroupDayPromptDetail[] = [];

    for (const prompt of dayPrompts) {
      const pa = answerMap.get(prompt.id);
      if (!pa) {
        promptDetails.push({
          prompt_id: prompt.id, word_a: prompt.word_a, word_b: prompt.word_b,
          clusters: [], answeredMembers: [],
        });
        continue;
      }

      for (const sid of pa.keys()) answeredSessions.add(sid);

      const clusterMap = new Map<string, { raw: string; members: string[] }>();
      for (const [sid, ans] of pa.entries()) {
        const name = nameMap.get(sid) ?? 'Unknown';
        const existing = clusterMap.get(ans.normalized) ?? { raw: ans.raw, members: [] };
        existing.members.push(name);
        clusterMap.set(ans.normalized, existing);
      }
      const clusters = Array.from(clusterMap.values())
        .map(c => ({ answer: c.raw, members: c.members }))
        .sort((a, b) => b.members.length - a.members.length);

      promptDetails.push({
        prompt_id: prompt.id, word_a: prompt.word_a, word_b: prompt.word_b,
        clusters,
        answeredMembers: Array.from(pa.keys()).map(sid => nameMap.get(sid) ?? 'Unknown'),
      });

      const entries = Array.from(pa.entries());
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[i][1].normalized === entries[j][1].normalized) {
            const nameA = nameMap.get(entries[i][0]) ?? 'Unknown';
            const nameB = nameMap.get(entries[j][0]) ?? 'Unknown';
            jinxPairs.push({
              memberA: nameA, memberB: nameB,
              answer: entries[i][1].raw,
              word_a: prompt.word_a, word_b: prompt.word_b,
            });
          }
        }
      }
    }

    if (answeredSessions.size > 0) {
      days.push({
        date,
        promptCount: dayPrompts.length,
        answeredCount: answeredSessions.size,
        memberCount: members.length,
        jinxPairs,
        totalJinxes: jinxPairs.length,
        prompts: promptDetails,
      });
    }
  }

  const oldestLoadedDate = prompts.length > 0 ? prompts[prompts.length - 1].date : windowStart;

  return {
    days,
    memberStats: lifetime.memberStats,
    totalDaysActive: lifetime.totalDaysActive,
    bestPair: lifetime.bestPair,
    hasMore,
    oldestLoadedDate,
    myAnsweredDates,
  };
}

// --- Share ---

export function buildGroupInviteText(group: JinxGroup): string {
  const name = getDisplayName();
  const url = `${window.location.origin}/g/${group.invite_code}`;
  const intro = name ? `${name} invited you to` : 'Join';
  return `⚡ JINX Daily\n\n${intro} the "${group.name}" group\n\nPlay the same daily word game and see who thinks alike.\n\n${url}`;
}

export async function renameGroup(groupId: string, newName: string): Promise<void> {
  await supabase
    .from('groups')
    .update({ name: newName.trim() })
    .eq('id', groupId);
}
