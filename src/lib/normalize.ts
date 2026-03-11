export function normalizeAnswer(raw: string): string {
  let answer = raw.toLowerCase().trim();
  answer = answer.replace(/[^a-z0-9\s]/g, '');
  answer = answer.replace(/\s+/g, ' ').trim();
  // Basic plural handling
  if (answer.endsWith('ies') && answer.length > 4) {
    answer = answer.slice(0, -3) + 'y';
  } else if (answer.endsWith('es') && answer.length > 3) {
    answer = answer.slice(0, -2);
  } else if (answer.endsWith('s') && !answer.endsWith('ss') && answer.length > 2) {
    answer = answer.slice(0, -1);
  }
  return answer;
}
