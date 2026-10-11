import { describe, expect, it } from 'vitest';
import { emptyDocument, newItem } from '../model/defaults';
import type { OfficialDocument } from '../model/types';
import { checkDocument } from './index';

function letter(over: Partial<OfficialDocument> = {}): OfficialDocument {
  return {
    ...emptyDocument('函'),
    date: '2025-03-20',
    sender: { name: '甲機關' },
    recipient: { name: '乙機關' },
    docNumber: 'A字第1號',
    subject: '有關提供日程一案，請查照。',
    explanation: [newItem(0, '依往例辦理。')],
    ...over,
  };
}
const ids = (d: OfficialDocument) => checkDocument(d).map((i) => i.id);

describe('checkDocument', () => {
  it('passes a clean letter', () => {
    expect(checkDocument(letter())).toEqual([]);
  });

  it('flags required fields', () => {
    const r = ids(letter({ sender: { name: '' }, recipient: { name: '' }, subject: '' }));
    expect(r).toEqual(expect.arrayContaining(['sender', 'recipient', 'subject-empty']));
  });

  it('flags missing expectation phrase in subject', () => {
    expect(ids(letter({ subject: '有關提供日程一案。' }))).toContain('subject-expect');
  });

  it('flags direction/expectation mismatch', () => {
    expect(ids(letter({ direction: '上行' }))).toContain('direction');
    expect(ids(letter({ direction: '平行', subject: '有關某事，請鑒核。' }))).toContain('direction');
    expect(ids(letter({ direction: '下行' }))).not.toContain('direction');
  });

  it('checks attachment consistency both ways', () => {
    expect(ids(letter({ subject: '檢送資料，請查照。' }))).toContain('att-missing');
    expect(ids(letter({ attachments: '資料一份' }))).toContain('att-unmentioned');
    expect(ids(letter({ subject: '檢送資料，請查照。', attachments: '資料一份' }))).toEqual([]);
  });

  it('flags western years and colloquial words', () => {
    const r = ids(letter({ explanation: [newItem(0, '2025年3月然後辦理。')] }));
    expect(r.some((i) => i.startsWith('west-year'))).toBe(true);
    expect(r.some((i) => i.startsWith('colloquial:然後'))).toBe(true);
  });

  it('applies type-specific rules', () => {
    const meeting = { ...emptyDocument('開會通知單'), sender: { name: '甲' }, recipient: { name: '乙' }, date: '2025-03-20', docNumber: 'x' };
    expect(ids(meeting)).toEqual(expect.arrayContaining(['m-reason', 'm-time', 'm-place']));
    const announce = { ...emptyDocument('公告'), sender: { name: '甲' }, date: '2025-03-20', docNumber: 'x', subject: '公告某事。' };
    expect(ids(announce)).toContain('announce');
    expect(ids(announce)).not.toContain('subject-expect');
    expect(ids(announce)).not.toContain('recipient');
  });

  it('checks the amendment comparison table', () => {
    const base = letter({ type: '法規修正案', subject: '擬修正章程第三條，提請審議案。' });
    expect(ids(base)).toEqual(expect.arrayContaining(['law-name', 'law-rows']));
    expect(ids(base)).not.toContain('subject-expect');
    const rows = [
      { id: 'r1', amended: '第三條　甲。', current: '第三條　乙。', reason: '修正文字。' },
      { id: 'r2', amended: '', current: '', reason: '說明而已。' },
      { id: 'r3', amended: '第五條　丙。', current: '第五條　丙。', reason: '' },
    ];
    const r = ids({ ...base, amendment: { lawName: '學生會組織章程', rows } });
    expect(r).not.toContain('law-name');
    expect(r).not.toContain('law-text:r1');
    expect(r).toEqual(expect.arrayContaining(['law-text:r2', 'law-reason:r3', 'law-same:r3']));
    const ok = ids({ ...base, amendment: { lawName: '學生會組織章程', rows: [rows[0]] } });
    expect(ok.filter((i) => i.startsWith('law'))).toEqual([]);
    expect(checkDocument(base).find((i) => i.id === 'law-name')!.where).toBe('條文對照表');
  });

  it('sorts errors before warnings and info', () => {
    const order = checkDocument(letter({ sender: { name: '' }, subject: '有關一案' })).map((i) => i.severity);
    expect(order).toEqual([...order].sort((a, b) => 'ewi'.indexOf(a[0]) - 'ewi'.indexOf(b[0])));
  });
});
