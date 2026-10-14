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
    expect(ids(announce)).not.toContain('subject-expect');
    expect(ids(announce)).not.toContain('recipient');
  });

  it('lets 令 omit 主旨 and 受文者 but not the body', () => {
    const order = { ...emptyDocument('令'), sender: { name: '學生議會議長' }, date: '2025-03-20', docNumber: 'x' };
    expect(ids(order)).toContain('body-empty');
    const r = ids({ ...order, explanation: [newItem(0, '茲任命王小明為第十五屆學生議會秘書長。')] });
    expect(r).not.toContain('body-empty');
    expect(r).not.toContain('subject-empty');
    expect(r).not.toContain('recipient');
  });

  it('checks the council table-type documents', () => {
    expect(ids(emptyDocument('會議紀錄'))).toEqual(expect.arrayContaining(['sender', 'm-reason', 'm-chair', 'm-recorder']));
    expect(ids(emptyDocument('簽到表'))).toEqual(expect.arrayContaining(['sender', 'm-reason']));
    const correction = ids(emptyDocument('糾正案'));
    expect(correction).toEqual(expect.arrayContaining(['recipient', 'subject-empty', 'motion-proposer']));
    expect(correction).not.toContain('date');
    const budget = emptyDocument('概算書');
    budget.budget.items = [{ id: 'x', unit: '', name: '文具', code: '', amount: '一百', note: '' }];
    expect(ids(budget)).toEqual(expect.arrayContaining(['sender', 'budget-year', 'budget-amount:x']));
    expect(ids(emptyDocument('審查報告對照表'))).toEqual(expect.arrayContaining(['draft-title', 'draft-rows', 'review-proposals']));
  });

  it('checks 議案關係文書 without letterhead rules', () => {
    const base = { ...emptyDocument('議案關係文書'), subject: '擬修正章程第三條。' };
    const r = ids(base);
    expect(r).toEqual(expect.arrayContaining(['motion-proposer', 'motion-term', 'motion-ending']));
    expect(r).not.toContain('sender');
    expect(r).not.toContain('docnum');
    const rows = [
      { id: 'r1', amended: '第三條　甲。', current: '第三條　乙。', reason: '修正文字。' },
      { id: 'r2', amended: '', current: '', reason: '說明而已。' },
      { id: 'r3', amended: '第五條　丙。', current: '第五條　丙。', reason: '' },
    ];
    const motion = { term: '十四', proposer: '王小明', cosigners: '王中明', draftTitle: '', mode: '修正' as const, rows, reviewer: '', proposalNames: [] };
    const r2 = ids({ ...base, subject: '是否有當？敬請公決。', motion });
    expect(r2).toEqual(expect.arrayContaining(['motion-cosigners', 'draft-title', 'draft-text:r2', 'draft-reason:r3', 'draft-same:r3']));
    expect(r2).not.toContain('draft-text:r1');
    const ok = ids({ ...base, subject: '是否有當？敬請公決。', motion: { ...motion, cosigners: '王中明 王大明', draftTitle: '章程修正草案', rows: [rows[0]] } });
    expect(ok).toEqual([]);
    const fresh = ids({ ...base, subject: '是否有當？敬請公決。', motion: { ...motion, cosigners: '', mode: '新訂' as const, draftTitle: '某法草案', rows: [{ id: 'n', amended: '', current: '', reason: '理由。' }] } });
    expect(fresh).toContain('draft-text:n');
  });

  it('sorts errors before warnings and info', () => {
    const order = checkDocument(letter({ sender: { name: '' }, subject: '有關一案' })).map((i) => i.severity);
    expect(order).toEqual([...order].sort((a, b) => 'ewi'.indexOf(a[0]) - 'ewi'.indexOf(b[0])));
  });
});
