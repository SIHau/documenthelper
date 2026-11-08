import { describe, expect, it } from 'vitest';
import { addWorkdays, processDeadline } from './deadline';

describe('addWorkdays', () => {
  it('跳過週六日', () => {
    expect(addWorkdays('2026-11-06', 1)).toBe('2026-11-09'); // 週五 → 下週一
    expect(addWorkdays('2026-11-06', 6)).toBe('2026-11-16'); // 週五 + 6 個工作天 = 下下週一
    expect(addWorkdays('2026-11-07', 1)).toBe('2026-11-09'); // 週六 → 下週一
  });
  it('跨月、跨年', () => {
    expect(addWorkdays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addWorkdays('2026-02-27', 1)).toBe('2026-03-02');
  });
  it('日期不正確時回傳空字串', () => {
    expect(addWorkdays('', 3)).toBe('');
    expect(addWorkdays('115/11/06', 3)).toBe('');
  });
});

describe('processDeadline', () => {
  it('依速別：最速件 1 天、速件 3 天、普通件 6 天，沒填視為普通件', () => {
    expect(processDeadline('2026-11-09', '最速件')).toMatchObject({ due: '2026-11-10', days: 1, basis: 'urgency' });
    expect(processDeadline('2026-11-09', '速件')?.due).toBe('2026-11-12');
    expect(processDeadline('2026-11-09', '普通件')?.due).toBe('2026-11-17');
    expect(processDeadline('2026-11-09', '')?.due).toBe('2026-11-17');
  });
  it('限期比較早時以限期為準；比較晚時不影響', () => {
    expect(processDeadline('2026-11-09', '普通件', '2026-11-12')).toMatchObject({ due: '2026-11-12', basis: 'limit' });
    expect(processDeadline('2026-11-09', '普通件', '2026-12-31')).toMatchObject({ due: '2026-11-17', basis: 'urgency' });
    expect(processDeadline('2026-11-09', '速件', 'abc')?.due).toBe('2026-11-12');
  });
  it('收文日不正確時回傳 null', () => {
    expect(processDeadline('', '速件')).toBeNull();
  });
});
