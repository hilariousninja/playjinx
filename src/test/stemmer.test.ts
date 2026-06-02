import { describe, it, expect } from 'vitest';
import { stemAnswer, normalizeAnswer } from '@/lib/normalize';

describe('stemAnswer — verb forms', () => {
  it('strips -ing with silent-e restoration', () => {
    expect(stemAnswer('driving')).toBe('drive');
    expect(stemAnswer('writing')).toBe('write');
    expect(stemAnswer('baking')).toBe('bake');
    expect(stemAnswer('hiding')).toBe('hide');
  });

  it('strips -ing with doubled consonants', () => {
    expect(stemAnswer('running')).toBe('run');
    expect(stemAnswer('stopping')).toBe('stop');
    expect(stemAnswer('swimming')).toBe('swim');
  });

  it('strips -ed with silent-e restoration', () => {
    expect(stemAnswer('baked')).toBe('bake');
    expect(stemAnswer('stopped')).toBe('stop');
  });

  it('handles -ied → -y', () => {
    expect(stemAnswer('carried')).toBe('carry');
    expect(stemAnswer('studied')).toBe('study');
  });

  it('maps irregulars to base form', () => {
    expect(stemAnswer('drove')).toBe('drive');
    expect(stemAnswer('driven')).toBe('drive');
    expect(stemAnswer('ran')).toBe('run');
    expect(stemAnswer('wrote')).toBe('write');
    expect(stemAnswer('written')).toBe('write');
    expect(stemAnswer('went')).toBe('go');
    expect(stemAnswer('thought')).toBe('think');
  });
});

describe('stemAnswer — noun/adjective derivations', () => {
  it('strips -ness', () => {
    expect(stemAnswer('happiness')).toBe('happy');
    expect(stemAnswer('sadness')).toBe('sad');
    expect(stemAnswer('kindness')).toBe('kind');
  });

  it('strips -ly adverbs', () => {
    expect(stemAnswer('happily')).toBe('happy');
    expect(stemAnswer('quickly')).toBe('quick');
    expect(stemAnswer('sadly')).toBe('sad');
  });

  it('strips -ity', () => {
    expect(stemAnswer('creativity')).toBe('creative');
    expect(stemAnswer('ability')).toBe('able');
  });

  it('handles -est superlative', () => {
    expect(stemAnswer('happiest')).toBe('happy');
    expect(stemAnswer('biggest')).toBe('big');
  });

  it('handles -er comparative for -ier adjectives', () => {
    expect(stemAnswer('happier')).toBe('happy');
  });

  it('maps irregular adjectives', () => {
    expect(stemAnswer('better')).toBe('good');
    expect(stemAnswer('best')).toBe('good');
    expect(stemAnswer('worse')).toBe('bad');
    expect(stemAnswer('worst')).toBe('bad');
  });
});

describe('stemAnswer — skip-list (false positives stay intact)', () => {
  it('leaves -ing nouns alone', () => {
    expect(stemAnswer('king')).toBe('king');
    expect(stemAnswer('ring')).toBe('ring');
    expect(stemAnswer('thing')).toBe('thing');
    expect(stemAnswer('string')).toBe('string');
    expect(stemAnswer('bring')).toBe('bring');
    expect(stemAnswer('morning')).toBe('morning');
    expect(stemAnswer('building')).toBe('building');
  });

  it('leaves -ed words that aren\'t past tense alone', () => {
    expect(stemAnswer('bed')).toBe('bed');
    expect(stemAnswer('red')).toBe('red');
    expect(stemAnswer('bread')).toBe('bread');
    expect(stemAnswer('speed')).toBe('speed');
  });

  it('leaves -ly non-adverbs alone', () => {
    expect(stemAnswer('only')).toBe('only');
    expect(stemAnswer('holy')).toBe('holy');
    expect(stemAnswer('ugly')).toBe('ugly');
    expect(stemAnswer('family')).toBe('family');
  });

  it('leaves -er nouns alone', () => {
    expect(stemAnswer('water')).toBe('water');
    expect(stemAnswer('sister')).toBe('sister');
    expect(stemAnswer('mother')).toBe('mother');
    expect(stemAnswer('computer')).toBe('computer');
  });

  it('leaves -est non-superlatives alone', () => {
    expect(stemAnswer('forest')).toBe('forest');
    expect(stemAnswer('honest')).toBe('honest');
  });
});

describe('stemAnswer — guards', () => {
  it('does not stem words shorter than 5 chars', () => {
    expect(stemAnswer('sing')).toBe('sing');
    expect(stemAnswer('go')).toBe('go');
    expect(stemAnswer('fly')).toBe('fly');
  });

  it('does not stem multi-word answers', () => {
    expect(stemAnswer('new york')).toBe('new york');
    expect(stemAnswer('ice cream')).toBe('ice cream');
  });

  it('preserves plural false-positives via depluralize skip-list', () => {
    expect(normalizeAnswer('tennis')).toBe('tennis');
    expect(normalizeAnswer('analysis')).toBe('analysis');
  });
});

describe('normalizeAnswer + stemAnswer integration', () => {
  it('groups drive/driving/drove under "drive"', () => {
    expect(stemAnswer(normalizeAnswer('Drive'))).toBe('drive');
    expect(stemAnswer(normalizeAnswer('driving'))).toBe('drive');
    expect(stemAnswer(normalizeAnswer('drove'))).toBe('drive');
    expect(stemAnswer(normalizeAnswer('driven'))).toBe('drive');
  });

  it('groups happy/happiness/happily/happier under "happy"', () => {
    expect(stemAnswer(normalizeAnswer('happy'))).toBe('happy');
    expect(stemAnswer(normalizeAnswer('Happiness'))).toBe('happy');
    expect(stemAnswer(normalizeAnswer('happily'))).toBe('happy');
    expect(stemAnswer(normalizeAnswer('happier'))).toBe('happy');
    expect(stemAnswer(normalizeAnswer('happiest'))).toBe('happy');
  });
});
