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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Group CRUD ---

export async function createGroup(name: string): Promise<JinxGroup> {
  const sessionId = getPlayerId();
  const inviteCode = generateInviteCode();

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
