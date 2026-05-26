import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import {
  GROUP_EMOJI_PRESETS,
  GROUP_ACCENT_PRESETS,
  getAccentTokens,
  type GroupAccent,
} from '@/lib/group-visuals';

interface Props {
  emoji: string;
  accent: GroupAccent;
  onChange: (next: { emoji: string; accent: GroupAccent }) => void;
}

export default function EmojiAccentPicker({ emoji, accent, onChange }: Props) {
  const [emojis] = useState(GROUP_EMOJI_PRESETS);
  const tokens = getAccentTokens(accent);

  const pickRandom = () => {
    const e = emojis[Math.floor(Math.random() * emojis.length)];
    const a = GROUP_ACCENT_PRESETS[Math.floor(Math.random() * GROUP_ACCENT_PRESETS.length)];
    onChange({ emoji: e, accent: a });
  };

  return (
    <div className="space-y-[10px]">
      {/* Live preview */}
      <div className={`flex items-center gap-[8px] px-[10px] py-[8px] rounded-[10px] border ${tokens.border} ${tokens.bg}`}>
        <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center ${tokens.bgStrong} border ${tokens.border}`}>
          <span className="text-[15px] leading-none">{emoji}</span>
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-[0.06em] ${tokens.text}`}>Preview</span>
        <button
          type="button"
          onClick={pickRandom}
          className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors p-[4px]"
          title="Randomize"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Emoji row */}
      <div>
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.06em] font-semibold mb-[5px]">Emoji</p>
        <div className="grid grid-cols-8 gap-[4px]">
          {emojis.map(e => {
            const selected = e === emoji;
            return (
              <button
                key={e}
                type="button"
                onClick={() => onChange({ emoji: e, accent })}
                className={`aspect-square rounded-[8px] text-[16px] flex items-center justify-center transition-all ${
                  selected
                    ? 'bg-primary/15 border-2 border-primary/40 scale-105'
                    : 'bg-muted/40 border border-transparent hover:bg-muted'
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent row */}
      <div>
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.06em] font-semibold mb-[5px]">Colour</p>
        <div className="flex gap-[6px]">
          {GROUP_ACCENT_PRESETS.map(a => {
            const t = getAccentTokens(a);
            const selected = a === accent;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ emoji, accent: a })}
                className={`flex-1 h-[28px] rounded-[8px] ${t.bgStrong} border-2 transition-all ${
                  selected ? `${t.ring} scale-[1.04]` : 'border-transparent hover:scale-105'
                }`}
                title={a}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
