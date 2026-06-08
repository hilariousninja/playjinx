import { describe, it, expect } from 'vitest';
import { suggestCorrection } from '@/lib/normalize';

const popular = [
  { normalized: 'boil', count: 12 },
  { normalized: 'boat', count: 8 },
  { normalized: 'rage', count: 6 },
  { normalized: 'management', count: 5 },
  { normalized: 'manager', count: 1 },
];

describe('suggestCorrection', () => {
  it('catches 1-edit typo on short word when target is popular', () => {
    expect(suggestCorrection('boul', popular)).toEqual({ suggestion: 'boil', distance: 1 });
  });

  it('does not suggest when candidate is itself popular', () => {
    expect(suggestCorrection('boat', popular)).toBeNull();
  });

  it('does not suggest when no close target exists', () => {
    expect(suggestCorrection('xyzabc', popular)).toBeNull();
  });

  it('does not suggest when target is too rare', () => {
    // "managr" → "manager" rejected because manager.count=1 < threshold
    expect(suggestCorrection('managr', popular)).toBeNull();
  });

  it('catches distance-2 typo on longer word', () => {
    expect(suggestCorrection('managment', popular)).toEqual({ suggestion: 'management', distance: 1 });
  });

  it('ignores multi-word candidates', () => {
    expect(suggestCorrection('ice creem', popular)).toBeNull();
  });

  it('ignores very short candidates', () => {
    expect(suggestCorrection('bo', popular)).toBeNull();
  });

  it('returns null when popular list is empty', () => {
    expect(suggestCorrection('boul', [])).toBeNull();
  });

  it('does not suggest exact match', () => {
    expect(suggestCorrection('boil', popular)).toBeNull();
  });
});
