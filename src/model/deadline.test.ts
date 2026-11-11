import { describe, expect, it } from 'vitest';
import { addLimitToSubject, addWorkdays, limitDateText, processDeadline } from './deadline';

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

describe('限期寫進主旨', () => {
  it('內文日期寫法：不加中華民國、月日不補 0', () => {
    expect(limitDateText('2026-11-05')).toBe('115年11月5日');
    expect(limitDateText('2027-01-09')).toBe('116年1月9日');
    expect(limitDateText('abc')).toBe('');
  });
  it('插在期望語之前', () => {
    expect(addLimitToSubject('檢送資料一案，請查照。', '2026-11-20')).toBe('檢送資料一案，於115年11月20日前辦理，請查照。');
    expect(addLimitToSubject('函請協助辦理，請惠復。', '2026-11-20')).toBe('函請協助辦理，於115年11月20日前辦理，請惠復。');
  });
  it('沒有期望語時接在句尾', () => {
    expect(addLimitToSubject('公告報名時間。', '2026-11-20')).toBe('公告報名時間，於115年11月20日前辦理。');
  });
  it('已寫過、主旨或限期為空時不動', () => {
    expect(addLimitToSubject('請於115年11月20日前回復，請查照。', '2026-11-20')).toBe('請於115年11月20日前回復，請查照。');
    expect(addLimitToSubject('', '2026-11-20')).toBe('');
    expect(addLimitToSubject('檢送資料，請查照。', '')).toBe('檢送資料，請查照。');
  });
});
