import { describe, expect, it } from 'vitest';
import { toMinguoText } from './date';

describe('toMinguoText', () => {
  it('converts to ROC date', () => {
    expect(toMinguoText('2025-09-29')).toBe('中華民國114年9月29日');
  });
  it('returns empty on invalid input', () => {
    expect(toMinguoText('')).toBe('');
    expect(toMinguoText('abc')).toBe('');
  });
});
