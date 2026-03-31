import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PromptRow, WordRow, scoreAllWords, ScoredWord } from './word-scoring';

export function useInsightsData() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [allWords, setAllWords] = useState<WordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [pRes, wRes] = await Promise.all([
      supabase.from('prompts')
        .select('id, word_a, word_b, total_players, unique_answers, top_answer_pct, performance, prompt_tag, date')
        .gt('total_players', 0)
        .order('total_players', { ascending: false }),
      supabase.from('words')
        .select('id, word, category, status, times_used, strong_appearances, decent_appearances, weak_appearances, avg_top_answer_pct, avg_unique_answers, in_core_deck, deck_override, jinx_score, generation_status, semantic_lane')
        .order('word', { ascending: true }),
    ]);
    setPrompts((pRes.data ?? []) as PromptRow[]);
    setAllWords((wRes.data ?? []) as WordRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes on words and prompts
    const channel = supabase
      .channel('insights-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'words' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as WordRow;
          setAllWords(prev => prev.map(w => w.id === updated.id ? updated : w));
        } else {
          // For INSERT/DELETE, refetch all
          fetchData();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompts' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playedPrompts = useMemo(() => prompts.filter(p => p.total_players > 0), [prompts]);

  const scoredWords: ScoredWord[] = useMemo(
    () => scoreAllWords(allWords, playedPrompts),
    [allWords, playedPrompts]
  );

  const stats = useMemo(() => {
    const totalPlayers = playedPrompts.reduce((s, p) => s + p.total_players, 0);
    const avgTopPct = playedPrompts.length > 0
      ? Math.round(playedPrompts.reduce((s, p) => s + p.top_answer_pct, 0) / playedPrompts.length)
      : 0;
    return { totalPlayers, avgTopPct, playedCount: playedPrompts.length };
  }, [playedPrompts]);

  const refreshWord = async (wordId: string) => {
    const { data } = await supabase.from('words')
      .select('id, word, category, status, times_used, strong_appearances, decent_appearances, weak_appearances, avg_top_answer_pct, avg_unique_answers, in_core_deck, deck_override, jinx_score, generation_status, semantic_lane')
      .eq('id', wordId)
      .single();
    if (data) {
      setAllWords(prev => prev.map(w => w.id === wordId ? data as WordRow : w));
    }
  };

  return { prompts: playedPrompts, allWords, scoredWords, loading, stats, refreshWord };
}
