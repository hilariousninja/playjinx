import { supabase } from '@/integrations/supabase/client';
import { getPlayerId, getUserAnswer, type DbPrompt } from './store';
import { normalizeAnswer } from './normalize';
import { getDisplayName, joinChallengeRoom } from './challenge-room';
import { saveMyRoom } from './my-room';

export interface ChallengeAnswer {
  prompt_id: string;
  raw_answer: string;
  normalized_answer: string;
}

export interface Challenge {
  id: string;
  token: string;
  date: string;
  challenger_session_id: string;
  answers: ChallengeAnswer[];
  created_at: string;
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Create a challenge from the current player's answers for today.
 * Returns the existing challenge if one already exists for this player+date.
 */
export async function createChallenge(prompts: DbPrompt[]): Promise<Challenge> {
  const playerId = getPlayerId();
  const date = prompts[0]?.date;
  if (!date) throw new Error('No prompts available');

  // Check if challenge already exists for this player + date
  const { data: existing } = await supabase
    .from('challenges')
    .select('*')
    .eq('challenger_session_id', playerId)
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    return {
      ...existing,
      answers: existing.answers as unknown as ChallengeAnswer[],
    };
  }

  // Gather answers
  const answers: ChallengeAnswer[] = [];
  for (const p of prompts) {
    const ua = await getUserAnswer(p.id);
    if (ua) {
      answers.push({
        prompt_id: p.id,
        raw_answer: ua.raw_answer,
        normalized_answer: ua.normalized_answer,
      });
    }
  }

  if (answers.length === 0) throw new Error('No answers found');

  const token = generateToken();
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      token,
      date,
      challenger_session_id: playerId,
      answers: answers as any,
    })
    .select()
    .single();

  if (error) throw error;

  const challenge = {
    ...data,
    answers: data.answers as unknown as ChallengeAnswer[],
  };

  // Auto-register challenger as room participant
  const displayName = getDisplayName();
  if (displayName) {
    try { await joinChallengeRoom(challenge.id, displayName); } catch { /* ok */ }
  }

  return challenge;
}

/**
 * Look up a challenge by its token.
 */
export async function getChallengeByToken(token: string): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    answers: data.answers as unknown as ChallengeAnswer[],
  };
}

/**
 * Get prompts for a specific date (used when loading challenge for a past day).
 */
export async function getPromptsForDate(date: string): Promise<DbPrompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('date', date)
    .in('mode', ['daily', 'archive'])
    .order('created_at')
    .limit(3);

  if (error) throw error;
  return data ?? [];
}

export interface ComparisonResult {
  prompt: DbPrompt;
  challengerAnswer: ChallengeAnswer;
  recipientAnswer: { raw_answer: string; normalized_answer: string } | null;
  matched: boolean;
}

/**
 * Compare the current player's answers against a challenger's.
 */
export async function compareAnswers(
  challenge: Challenge,
  prompts: DbPrompt[]
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];

  for (const prompt of prompts) {
    const challengerAnswer = challenge.answers.find(a => a.prompt_id === prompt.id);
    if (!challengerAnswer) continue;

    const userAnswer = await getUserAnswer(prompt.id);

    let matched = false;
    if (userAnswer) {
      // Compare normalized answers
      const userNorm = normalizeAnswer(userAnswer.raw_answer);
      const challNorm = challengerAnswer.normalized_answer;
      matched = userNorm === challNorm;
    }

    results.push({
      prompt,
      challengerAnswer,
      recipientAnswer: userAnswer
        ? { raw_answer: userAnswer.raw_answer, normalized_answer: normalizeAnswer(userAnswer.raw_answer) }
        : null,
      matched,
    });
  }

  return results;
}

/**
 * Build the share text for a challenge link.
 */
export function buildChallengeShareText(prompts: DbPrompt[], token: string): string {
  const name = getDisplayName();
  const pairs = prompts.map(p => `${p.word_a.toUpperCase()} + ${p.word_b.toUpperCase()}`).join('\n');
  const url = `${window.location.origin}/c/${token}`;
  const intro = name ? `Can you match ${name}?` : 'Can you match me?';
  return `⚡ JINX Daily\n\n${intro}\n\n${pairs}\n\n${url}`;
}

/**
 * Check if the current player is the challenger.
 */
export function isChallenger(challenge: Challenge): boolean {
  return challenge.challenger_session_id === getPlayerId();
}
