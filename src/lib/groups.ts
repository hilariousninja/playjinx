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

export interface GroupWithActivity extends JinxGroup {
  memberCount: number;
  hasActivityToday: boolean;
  todayAnsweredCount: number;
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
}

export async function getGroupHistory(groupId: string): Promise<GroupHistoryData> {
  const members = await getGroupMembers(groupId);
  if (members.length === 0) return { days: [], memberStats: [], totalDaysActive: 0, bestPair: null };

  const sessionIds = members.map(m => m.session_id);
  const nameMap = new Map(members.map(m => [m.session_id, m.display_name]));
  const today = new Date().toISOString().slice(0, 10);

  // Get past 14 days of prompts (excluding today)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, word_a, word_b, date')
    .in('mode', ['daily', 'archive'])
    .gte('date', twoWeeksAgo)
    .lt('date', today)
    .order('date', { ascending: false });

  if (!prompts || prompts.length === 0) return { days: [], memberStats: [], totalDaysActive: 0, bestPair: null };

  const promptIds = prompts.map(p => p.id);

  // Get answers from group members for these prompts
  const { data: answers } = await supabase
    .from('answers')
    .select('prompt_id, session_id, raw_answer, normalized_answer')
    .in('prompt_id', promptIds)
    .in('session_id', sessionIds);

  if (!answers) return { days: [], memberStats: [], totalDaysActive: 0, bestPair: null };

  // Group prompts by date
  const promptsByDate = new Map<string, typeof prompts>();
  for (const p of prompts) {
    const list = promptsByDate.get(p.date) ?? [];
    list.push(p);
    promptsByDate.set(p.date, list);
  }

  // Build answer lookup: prompt_id -> session_id -> { raw, normalized }
  const answerMap = new Map<string, Map<string, { raw: string; normalized: string }>>();
  for (const a of answers) {
    if (!answerMap.has(a.prompt_id)) answerMap.set(a.prompt_id, new Map());
    answerMap.get(a.prompt_id)!.set(a.session_id, { raw: a.raw_answer, normalized: a.normalized_answer });
  }

  // Track pair-level jinx counts
  const pairJinxes = new Map<string, { nameA: string; nameB: string; count: number }>();
  const memberJinxes = new Map<string, { total: number; daysPlayed: Set<string> }>();

  const days: GroupDaySnapshot[] = [];

  for (const [date, dayPrompts] of promptsByDate) {
    const jinxPairs: GroupDaySnapshot['jinxPairs'] = [];
    const answeredSessions = new Set<string>();

    for (const prompt of dayPrompts) {
      const pa = answerMap.get(prompt.id);
      if (!pa) continue;

      // Track who answered
      for (const sid of pa.keys()) answeredSessions.add(sid);

      // Find jinxes (matching answers between members)
      const entries = Array.from(pa.entries());
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[i][1] === entries[j][1]) {
            const nameA = nameMap.get(entries[i][0]) ?? 'Unknown';
            const nameB = nameMap.get(entries[j][0]) ?? 'Unknown';
            jinxPairs.push({
              memberA: nameA, memberB: nameB,
              answer: entries[i][1],
              word_a: prompt.word_a, word_b: prompt.word_b,
            });

            // Track pair stats
            const pairKey = [entries[i][0], entries[j][0]].sort().join(':');
            const existing = pairJinxes.get(pairKey) ?? { nameA, nameB, count: 0 };
            existing.count++;
            pairJinxes.set(pairKey, existing);
          }
        }
      }
    }

    // Track member stats
    for (const sid of answeredSessions) {
      const ms = memberJinxes.get(sid) ?? { total: 0, daysPlayed: new Set() };
      ms.daysPlayed.add(date);
      const memberPairJinxes = jinxPairs.filter(j => {
        const name = nameMap.get(sid);
        return j.memberA === name || j.memberB === name;
      }).length;
      ms.total += memberPairJinxes;
      memberJinxes.set(sid, ms);
    }

    if (answeredSessions.size > 0) {
      days.push({
        date,
        promptCount: dayPrompts.length,
        answeredCount: answeredSessions.size,
        memberCount: members.length,
        jinxPairs,
        totalJinxes: jinxPairs.length,
      });
    }
  }

  const memberStats: GroupMemberStats[] = Array.from(memberJinxes.entries()).map(([sid, ms]) => ({
    session_id: sid,
    display_name: nameMap.get(sid) ?? 'Unknown',
    totalJinxes: ms.total,
    daysPlayed: ms.daysPlayed.size,
  })).sort((a, b) => b.totalJinxes - a.totalJinxes);

  const bestPairEntry = Array.from(pairJinxes.values()).sort((a, b) => b.count - a.count)[0] ?? null;
  const bestPair = bestPairEntry ? { nameA: bestPairEntry.nameA, nameB: bestPairEntry.nameB, jinxCount: bestPairEntry.count } : null;

  return {
    days,
    memberStats,
    totalDaysActive: days.length,
    bestPair,
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
