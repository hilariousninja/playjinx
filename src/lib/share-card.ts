/**
 * Shareable result card — renders a 1080×1350 PNG snapshot of the day's results.
 *
 * Snapshot semantics:
 *  - When sample size is low (< 10 max responses on any prompt), the card is
 *    labeled "Early results" so it doesn't feel overly final.
 *  - Otherwise it's labeled "Results so far" with the date.
 *
 * Usage: build a ShareCardData object and call `shareResultCard(data)`.
 *  - On supporting browsers (Web Share Level 2 with files) the image is shared
 *    natively. Otherwise it downloads the PNG and copies a fallback caption.
 */

export interface ShareCardRow {
  wordA: string;
  wordB: string;
  answer: string | null; // raw user answer (null = missed)
  matched: boolean;      // overlapped with at least one other player
  topAnswer: boolean;    // user's cluster was largest
  jinxes: number;        // overlap count for this prompt
}

export interface ShareCardData {
  rows: ShareCardRow[];
  totalJinxes: number;   // sum across the day
  matchedPrompts: number;
  totalPrompts: number;
  maxResponses: number;  // max total submissions across prompts (for sample-size labeling)
  streakCurrent?: number;
  date: Date;
}

const W = 1080;
const H = 1350;

// JINX brand HSL — kept in sync with src/index.css
const C = {
  bg: '#F6F1E7',           // hsl(40 33% 96%)
  card: '#FFFFFF',
  ink: '#231F1A',          // hsl(20 10% 12%)
  muted: '#8A8278',        // hsl(20 8% 50%)
  border: '#E5DED1',       // hsl(35 15% 87%)
  amber: '#F59E0B',        // hsl(38 92% 50%)
  amberSoft: '#FCEFD2',
  green: '#1FAB5C',        // hsl(142 72% 40%)
  greenSoft: '#DDF2E5',
  blue: '#2563D9',         // hsl(220 72% 50%)
};

function loadFonts(): Promise<void> {
  // Best-effort: ensure Space Grotesk is available before drawing.
  if (typeof document === 'undefined' || !(document as any).fonts) return Promise.resolve();
  return Promise.all([
    (document as any).fonts.load('700 64px "Space Grotesk"'),
    (document as any).fonts.load('600 32px "Space Grotesk"'),
    (document as any).fonts.load('500 24px "Space Grotesk"'),
  ]).then(() => undefined).catch(() => undefined);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Mini X mark
  const m = size * 0.9;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, size * 0.14);
  // accent diagonals
  ctx.strokeStyle = C.blue;
  ctx.beginPath();
  ctx.moveTo(x + m * 0.11, y + m * 0.11);
  ctx.lineTo(x + m * 0.39, y + m * 0.39);
  ctx.moveTo(x + m * 0.61, y + m * 0.61);
  ctx.lineTo(x + m * 0.89, y + m * 0.89);
  ctx.stroke();
  // primary diagonal
  ctx.strokeStyle = C.amber;
  ctx.beginPath();
  ctx.moveTo(x + m * 0.89, y + m * 0.11);
  ctx.lineTo(x + m * 0.11, y + m * 0.89);
  ctx.stroke();
  // wordmark
  ctx.fillStyle = C.ink;
  ctx.font = `800 ${Math.round(size * 0.62)}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('JINX', x + m + 14, y + m / 2 + 2);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  await loadFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ──
  drawWordmark(ctx, 64, 64, 64);

  // Sample-size aware status pill
  const earlySample = data.maxResponses > 0 && data.maxResponses < 10;
  const pillLabel = earlySample ? 'Early results' : 'Results so far';
  const pillBg = earlySample ? C.amberSoft : '#EDE6D6';
  const pillFg = earlySample ? '#7A4A00' : C.muted;
  ctx.font = `600 22px "Space Grotesk", system-ui, sans-serif`;
  const pillTextW = ctx.measureText(pillLabel).width;
  const pillW = pillTextW + 36;
  const pillH = 40;
  const pillX = W - 64 - pillW;
  const pillY = 76;
  ctx.fillStyle = pillBg;
  roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = pillFg;
  ctx.textBaseline = 'middle';
  ctx.fillText(pillLabel, pillX + 18, pillY + pillH / 2 + 1);

  // Date
  ctx.fillStyle = C.muted;
  ctx.font = `500 24px "Space Grotesk", system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fmtDate(data.date), 64, 180);

  // ── Hero JINX total ──
  const heroY = 230;
  ctx.fillStyle = C.ink;
  ctx.font = `800 140px "Space Grotesk", system-ui, sans-serif`;
  const heroLabel = `${data.totalJinxes}`;
  ctx.fillText(heroLabel, 64, heroY + 130);

  // ⚡ glyph
  ctx.fillStyle = C.amber;
  ctx.font = `800 80px "Space Grotesk", system-ui, sans-serif`;
  const heroW = ctx.measureText(heroLabel).width;
  ctx.fillText('⚡', 64 + heroW + 22, heroY + 110);

  ctx.fillStyle = C.muted;
  ctx.font = `600 28px "Space Grotesk", system-ui, sans-serif`;
  const subLabel = `JINX${data.totalJinxes === 1 ? '' : 'es'} · ${data.matchedPrompts}/${data.totalPrompts} matched`;
  ctx.fillText(subLabel, 64, heroY + 175);

  // ── Prompt rows ──
  const rowsY = 470;
  const rowH = 150;
  const gap = 18;
  data.rows.forEach((row, i) => {
    const y = rowsY + i * (rowH + gap);
    // card
    ctx.fillStyle = C.card;
    roundedRect(ctx, 64, y, W - 128, rowH, 20);
    ctx.fill();

    // left accent stripe
    const stripeColor = row.topAnswer && row.matched ? C.green
      : row.matched ? C.amber
      : C.border;
    ctx.fillStyle = stripeColor;
    roundedRect(ctx, 64, y, 8, rowH, 4);
    ctx.fill();

    // prompt pair (small label)
    ctx.fillStyle = C.muted;
    ctx.font = `600 22px "Space Grotesk", system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${row.wordA.toUpperCase()} + ${row.wordB.toUpperCase()}`, 100, y + 42);

    // answer (large)
    ctx.fillStyle = row.answer ? C.ink : C.muted;
    ctx.font = `700 46px "Space Grotesk", system-ui, sans-serif`;
    const answerText = row.answer ?? 'Missed';
    // truncate visually if extremely long
    const maxAnsW = W - 128 - 80 - 200;
    let displayAns = answerText;
    if (ctx.measureText(displayAns).width > maxAnsW) {
      while (displayAns.length > 4 && ctx.measureText(displayAns + '…').width > maxAnsW) {
        displayAns = displayAns.slice(0, -1);
      }
      displayAns += '…';
    }
    ctx.fillText(displayAns, 100, y + 100);

    // right side: jinx pill
    if (row.jinxes > 0) {
      const lbl = `⚡${row.jinxes}`;
      ctx.font = `700 30px "Space Grotesk", system-ui, sans-serif`;
      const w = ctx.measureText(lbl).width + 32;
      const ph = 48;
      const px = W - 64 - 16 - w;
      const py = y + (rowH - ph) / 2;
      ctx.fillStyle = row.topAnswer ? C.greenSoft : C.amberSoft;
      roundedRect(ctx, px, py, w, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = row.topAnswer ? '#0F6E3C' : '#7A4A00';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, px + 16, py + ph / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    } else if (row.answer) {
      ctx.fillStyle = C.muted;
      ctx.font = `500 22px "Space Grotesk", system-ui, sans-serif`;
      const lbl = 'no overlap yet';
      const w = ctx.measureText(lbl).width;
      ctx.fillText(lbl, W - 64 - 16 - w, y + rowH / 2 + 8);
    }
  });

  // ── Footer ──
  const footY = H - 100;
  // streak (optional, subtle)
  if (data.streakCurrent && data.streakCurrent > 0) {
    ctx.fillStyle = C.ink;
    ctx.font = `600 24px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillText(`🔥 ${data.streakCurrent}-day streak`, 64, footY);
  }

  ctx.fillStyle = C.muted;
  ctx.font = `500 22px "Space Grotesk", system-ui, sans-serif`;
  const url = 'playjinx.com';
  const urlW = ctx.measureText(url).width;
  ctx.fillText(url, W - 64 - urlW, footY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
  });
}

/**
 * Try native share with the rendered image; fall back to download + caption copy.
 */
export async function shareResultCard(
  data: ShareCardData,
  caption: string
): Promise<{ shared: boolean; downloaded: boolean }> {
  const blob = await renderShareCard(data);
  const file = new File([blob], 'jinx-results.png', { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: caption });
      return { shared: true, downloaded: false };
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }

  // Fallback: download the PNG, copy the caption
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jinx-results.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try { await navigator.clipboard.writeText(caption); } catch {}
  return { shared: false, downloaded: true };
}
