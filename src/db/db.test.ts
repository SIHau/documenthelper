import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { idb } from './idb';
import { exportAll, parseBackup, restore } from './backup';
import { agenciesToCsv, csvToAgencies, emptyAgency, mergeAgencies, parseCsv } from './csv';
import { emptyDocument, newItem } from '../model/defaults';
import { draftTitle, instantiate, isBlank } from '../model/template';
import { matchAgency, matchDraft } from '../search';
import type { Agency, DraftRecord } from './types';

beforeEach(async () => {
  for (const s of ['contacts', 'drafts', 'templates'] as const) await idb.clear(s);
});

const agency = (name: string, extra: Partial<Agency> = {}): Agency => ({ ...emptyAgency(), name, ...extra });

describe('idb', () => {
  it('put / getAll / remove', async () => {
    const a = agency('甲機關', { code: '379100000A' });
    await idb.put('contacts', a);
    await idb.put('contacts', { ...a, phone: '02-1' });
    expect(await idb.getAll<Agency>('contacts')).toEqual([{ ...a, phone: '02-1' }]);
    await idb.remove('contacts', a.id);
    expect(await idb.getAll('contacts')).toEqual([]);
  });
});

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const list = [agency('甲, 乙 "局"', { address: '一路\n二號', note: 'x' })];
    const back = csvToAgencies(agenciesToCsv(list));
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ name: '甲, 乙 "局"', address: '一路\n二號', note: 'x' });
  });
  it('parses CRLF and skips blank lines', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('requires a 名稱 column', () => {
    expect(() => csvToAgencies('foo,bar\n1,2')).toThrow('名稱');
  });
  it('merges by name, keeping existing ids', () => {
    const old = agency('甲', { code: 'old' });
    const { merged, added, updated } = mergeAgencies([old], [agency('甲', { code: 'new' }), agency('乙')]);
    expect({ added, updated }).toEqual({ added: 1, updated: 1 });
    expect(merged.find((m) => m.name === '甲')).toMatchObject({ id: old.id, code: 'new' });
  });
});

describe('backup', () => {
  it('exports, validates and restores', async () => {
    const doc = { ...emptyDocument(), subject: '主旨' };
    const draft: DraftRecord = { id: 'd1', title: '主旨', doc, updatedAt: 1 };
    await idb.put('drafts', draft);
    await idb.put('contacts', agency('甲'));
    const text = JSON.stringify(await exportAll());
    await idb.clear('drafts');
    await idb.clear('contacts');
    await restore(parseBackup(text));
    expect((await idb.getAll<DraftRecord>('drafts'))[0].doc.subject).toBe('主旨');
    expect(await idb.getAll('contacts')).toHaveLength(1);
  });
  it('rejects foreign files', () => {
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup('{"a":1}')).toThrow('備份檔');
  });
});

describe('template & search helpers', () => {
  it('instantiate resets date/number and re-ids items', () => {
    const src = { ...emptyDocument(), docNumber: 'X字第1號', date: '2020-01-01', explanation: [newItem(0, 'a')] };
    const out = instantiate(src, '2025-05-05');
    expect(out.date).toBe('2025-05-05');
    expect(out.docNumber).toBe('');
    expect(out.explanation[0].id).not.toBe(src.explanation[0].id);
    expect(out.explanation[0].text).toBe('a');
  });
  it('isBlank / draftTitle', () => {
    expect(isBlank(emptyDocument())).toBe(true);
    const d = { ...emptyDocument(), subject: '某案' };
    expect(isBlank(d)).toBe(false);
    expect(draftTitle(d)).toBe('某案');
    expect(draftTitle(emptyDocument())).toBe('（未命名）');
  });
  it('matches all terms across fields', () => {
    const d = { ...emptyDocument(), subject: '選舉日程', recipient: { name: '選舉委員會' } };
    const rec: DraftRecord = { id: '1', title: '選舉日程', doc: d, updatedAt: 0 };
    expect(matchDraft(rec, '選舉 委員會')).toBe(true);
    expect(matchDraft(rec, '選舉 財務')).toBe(false);
    expect(matchAgency(agency('教育局', { code: 'E01' }), 'e01')).toBe(true);
  });
});
