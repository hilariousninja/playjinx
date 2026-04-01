import { useState, useCallback } from 'react';
import { Loader2, Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInsightsData } from './insights/useInsightsData';
import InsightsOverview from './insights/InsightsOverview';
import InsightsPrompts from './insights/InsightsPrompts';
import InsightsWords from './insights/InsightsWords';

export default function DashboardInsights() {
  const { prompts, scoredWords, loading, stats, refreshWord, refetchAll } = useInsightsData();
  const [exporting, setExporting] = useState(false);

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { data: allPrompts } = await supabase
        .from('prompts')
        .select('id, word_a, word_b, date, total_players, unique_answers, top_answer_pct, performance, prompt_tag')
        .gt('total_players', 0)
        .order('date', { ascending: false });

      if (!allPrompts?.length) { toast.error('No play data to export'); return; }

      const promptIds = allPrompts.map(p => p.id);
      const allAnswers: { prompt_id: string; normalized_answer: string }[] = [];
      for (let i = 0; i < promptIds.length; i += 50) {
        const chunk = promptIds.slice(i, i + 50);
        const { data } = await supabase.from('answers').select('prompt_id, normalized_answer').in('prompt_id', chunk);
        if (data) allAnswers.push(...data);
      }

      const answerMap = new Map<string, Map<string, number>>();
      for (const a of allAnswers) {
        if (!answerMap.has(a.prompt_id)) answerMap.set(a.prompt_id, new Map());
        const m = answerMap.get(a.prompt_id)!;
        m.set(a.normalized_answer, (m.get(a.normalized_answer) || 0) + 1);
      }

      const csvRows = ['Date,Word A,Word B,Total Players,Unique Answers,Top Answer %,Performance,Tag,Answer,Answer Count,Answer %'];
      for (const p of allPrompts) {
        const answers = answerMap.get(p.id);
        if (answers && answers.size > 0) {
          const sorted = [...answers.entries()].sort((a, b) => b[1] - a[1]);
          for (const [answer, count] of sorted) {
            const pct = p.total_players > 0 ? ((count / p.total_players) * 100).toFixed(1) : '0';
            csvRows.push([p.date, esc(p.word_a), esc(p.word_b), p.total_players, p.unique_answers, p.top_answer_pct, p.performance || '', p.prompt_tag || '', esc(answer), count, pct].join(','));
          }
        } else {
          csvRows.push([p.date, esc(p.word_a), esc(p.word_b), p.total_players, p.unique_answers, p.top_answer_pct, p.performance || '', p.prompt_tag || '', '', 0, 0].join(','));
        }
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jinx_archive_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allPrompts.length} prompts with ${allAnswers.length} answers`);
    } catch (e) {
      toast.error('Export failed');
      console.error(e);
    } finally {
      setExporting(false);
    }
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Insights</h1>
          <p className="text-[10px] text-muted-foreground">Analysis and deck curation from historical play data.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="text-xs gap-1.5">
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Export Archive
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs">Prompts</TabsTrigger>
          <TabsTrigger value="words" className="text-xs">Words</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <InsightsOverview prompts={prompts} scoredWords={scoredWords} stats={stats} />
        </TabsContent>

        <TabsContent value="prompts">
          <InsightsPrompts prompts={prompts} />
        </TabsContent>

        <TabsContent value="words">
          <InsightsWords scoredWords={scoredWords} refreshWord={refreshWord} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
