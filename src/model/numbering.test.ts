import { describe, expect, it } from 'vitest';
import { numberItems, toChineseNumber } from './numbering';

const item = (level: number, text = 'x') => ({ id: text + level, level, text });

describe('toChineseNumber', () => {
  it('handles 1-99', () => {
    expect(toChineseNumber(1)).toBe('一');
    expect(toChineseNumber(10)).toBe('十');
    expect(toChineseNumber(11)).toBe('十一');
    expect(toChineseNumber(20)).toBe('二十');
    expect(toChineseNumber(21)).toBe('二十一');
  });
});

describe('numberItems', () => {
  it('numbers nested levels and resets deeper counters', () => {
    const labels = numberItems([
      item(0), item(1), item(1), item(2), item(0), item(1),
    ]).map((i) => i.label);
    expect(labels).toEqual(['一、', '(一)', '(二)', '１、', '二、', '(一)']);
  });

  it('does not allow skipping levels', () => {
    const out = numberItems([item(2), item(3)]);
    expect(out.map((i) => i.label)).toEqual(['一、', '(一)']);
    expect(out.map((i) => i.level)).toEqual([0, 1]);
  });

  it('uses full-width digits at levels 3 and 4 and half-width parentheses', () => {
    const labels = numberItems([item(0), item(1), item(2), item(3), item(2)]).map((i) => i.label);
    expect(labels).toEqual(['一、', '(一)', '１、', '(１)', '２、']);
    const twelve = numberItems(Array.from({ length: 12 }, () => item(0)));
    expect(twelve[11].label).toBe('十二、');
    const deep = Array.from({ length: 11 }, (_, i) => (i === 0 ? [item(0), item(1), item(2)] : [item(2)])).flat();
    const numbered = numberItems(deep);
    expect(numbered[numbered.length - 1].label).toBe('１１、');
  });
});
