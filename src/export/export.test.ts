import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { emptyDocument, newItem } from '../model/defaults';
import type { OfficialDocument } from '../model/types';
import { buildBlocks, exportFileName } from './layout';
import { buildOdt } from './odt';
import { buildDocx } from './docx';

function sample(): OfficialDocument {
  const d = emptyDocument();
  d.date = '2025-03-20';
  d.sender.name = '學生議會侯承佑議員';
  d.recipient.name = '學生選舉委員會';
  d.subject = '有關 & <提供> "日程" 一案，請查照。';
  d.contact = { person: '侯承佑', phone: '02-1234', email: 'a@b.tw', fax: '' };
  d.explanation = [newItem(0, '依往例辦理。'), newItem(1, '細項  兩個空白\n換行')];
  d.signature = { enabled: true, title: '學生議員', name: '侯承佑', font: 'yuji-boku' };
  return d;
}

describe('buildBlocks', () => {
  it('omits empty optional rows and includes signature', () => {
    const text = buildBlocks(sample()).map((b) => b.runs.map((r) => r.text).join(''));
    expect(text.some((t) => t.startsWith('傳真'))).toBe(false);
    expect(text).toContain('承辦人：侯承佑');
    expect(text[text.length - 1]).toContain('侯承佑');
  });
  it('names export files safely', () => {
    expect(exportFileName(sample(), 'odt')).toBe('函_2025-03-20_有關&<提供>日程一案，請查照。'.replace(/[<>"]/g, '') + '.odt');
  });
});

describe('buildBlocks per doc type', () => {
  const texts = (d: OfficialDocument) => buildBlocks(d).map((b) => b.runs.map((r) => r.text).join(''));

  it('公告 has 依據/公告事項 and no 受文者', () => {
    const d = { ...sample(), type: '公告' as const, measures: [newItem(0, '公告內容。')] };
    const t = texts(d);
    expect(t).toContain('依據：');
    expect(t).toContain('公告事項：');
    expect(t.some((x) => x.startsWith('受文者'))).toBe(false);
    expect(t[0]).toContain('公告');
  });

  it('簽 puts 敬陳 at the end, before the signature', () => {
    const d = { ...sample(), type: '簽' as const, recipient: { name: '校長' }, measures: [newItem(0, '擬照辦。')] };
    const t = texts(d);
    expect(t).toContain('擬辦：');
    expect(t.some((x) => x.startsWith('受文者'))).toBe(false);
    expect(t.indexOf('敬陳　校長')).toBeGreaterThan(t.indexOf('擬辦：'));
    expect(t.indexOf('敬陳　校長')).toBeLessThan(t.length - 1);
  });

  it('開會通知單 lists meeting rows and skips 主旨', () => {
    const d = { ...sample(), type: '開會通知單' as const };
    d.meeting = { ...d.meeting, reason: '討論選舉', time: '114年4月1日', place: '會議室' };
    const t = texts(d);
    expect(t).toEqual(expect.arrayContaining(['開會事由：討論選舉', '開會時間：114年4月1日', '開會地點：會議室']));
    expect(t.some((x) => x.startsWith('主旨'))).toBe(false);
  });
});

describe('buildOdt', () => {
  it('writes mimetype first and well-formed XML', async () => {
    const zip = await JSZip.loadAsync(await buildOdt(sample()));
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/vnd.oasis.opendocument.text');
    for (const name of ['content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']) {
      const xml = await zip.file(name)!.async('string');
      const errors: string[] = [];
      new DOMParser({ onError: (_l: string, m: string) => errors.push(m) }).parseFromString(xml, 'text/xml');
      expect(errors, name).toEqual([]);
    }
    const content = await zip.file('content.xml')!.async('string');
    expect(content).toContain('&amp; &lt;提供&gt;');
    expect(content).toContain('Yuji Boku');
    expect(content).toContain('<text:line-break/>');
  });
});

describe('buildDocx', () => {
  it('produces a docx containing the text', async () => {
    const blob = await buildDocx(sample());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('學生選舉委員會');
    expect(xml).toContain('Yuji Boku');
  });
});
