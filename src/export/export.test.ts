import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { emptyDocument, newItem } from '../model/defaults';
import type { OfficialDocument } from '../model/types';
import { buildBlocks, exportFileName, pageHeader } from './layout';
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
  it('names export files after the document number', () => {
    const d = { ...sample(), docNumber: '裙萌議侯字第 2026/1140416001號' };
    expect(exportFileName(d, 'pdf')).toBe('裙萌議侯字第20261140416001號.pdf');
    expect(exportFileName(d, 'odt')).toBe('裙萌議侯字第20261140416001號.odt');
  });
  it('falls back to type/date/subject when there is no document number', () => {
    expect(exportFileName({ ...sample(), docNumber: '' }, 'odt')).toBe('函_2025-03-20_有關&提供日程一案，請查照。.odt');
  });
});

describe('buildBlocks per doc type', () => {
  const texts = (d: OfficialDocument) => buildBlocks(d).map((b) => b.runs.map((r) => r.text).join(''));

  it('公告 has 主旨/依據/說明 and no 受文者 or 檔號 (council template)', () => {
    const d = { ...sample(), type: '公告' as const, measures: [newItem(0, '公告內容。')] };
    const t = texts(d);
    expect(t).toContain('依據：');
    expect(t).toContain('說明：');
    expect(t.some((x) => x.startsWith('檔　　號'))).toBe(false);
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

  it('開會通知單 numbers 備註 and puts the agenda on a new page', () => {
    const d = { ...sample(), type: '開會通知單' as const };
    d.meeting = { ...d.meeting, time: '114年4月1日', place: '會議室', remarks: '不印紙本。\n準時出席。', agenda: '第十五屆學生議會\n法制委員會第一次會議' };
    d.explanation = [newItem(0, '主席報告。')];
    d.measures = [newItem(0, '審查預算案。')];
    const blocks = buildBlocks(d);
    const t = texts(d);
    expect(t).toEqual(expect.arrayContaining(['備註：', '一、不印紙本。', '二、準時出席。']));
    const agenda = blocks.findIndex((b) => b.pageBreakBefore);
    expect(t[agenda]).toBe('第十五屆學生議會');
    expect(t.slice(agenda)).toEqual(expect.arrayContaining(['報告事項', '一、主席報告。', '討論事項', '一、審查預算案。', '開會地點：會議室']));
    expect(agenda).toBeGreaterThan(t.findIndex((x) => x.includes('侯承佑') && x.includes('學生議員')));
  });

  it('函 follows the council letterhead: 檔號 box, 20pt title, 12pt head rows', () => {
    const d = { ...sample(), docNumber: '議字第1140320001號', archive: { fileNo: '114/01', retention: '5年' } };
    const blocks = buildBlocks(d);
    const t = texts(d);
    expect(t.slice(0, 3)).toEqual(['檔　　號：114/01', '保存年限：5年', '學生議會侯承佑議員　函']);
    expect(blocks[2].runs[0]).toMatchObject({ size: 20 });
    expect(blocks[t.indexOf('發文字號：議字第1140320001號')].runs[0].size).toBe(12);
    expect(t.indexOf('受文者：學生選舉委員會')).toBeLessThan(t.indexOf('發文日期：中華民國114年3月20日'));
  });

  it('令 puts 受文者 after the head rows and prints a bare body without 說明', () => {
    const d = { ...sample(), type: '令' as const, subject: '', explanation: [newItem(0, '茲任命王小明為秘書長。')] };
    const t = texts(d);
    expect(t.indexOf('受文者：學生選舉委員會')).toBeGreaterThan(t.findIndex((x) => x.startsWith('發文日期')));
    expect(t).toContain('茲任命王小明為秘書長。');
    expect(t.some((x) => x.startsWith('主旨') || x.startsWith('說明'))).toBe(false);
    const noRecipient = texts({ ...d, recipient: { name: '' } });
    expect(noRecipient.some((x) => x.startsWith('受文者'))).toBe(false);
  });
});

function motionSample(): OfficialDocument {
  const d = { ...sample(), type: '議案關係文書' as const };
  d.subject = '本會議員王小明等三人，擬具「學生會組織章程」修正草案，是否有當？敬請公決。';
  d.motion = {
    term: '十四',
    proposer: '王小明',
    cosigners: '王中明、王大明 林大明 林小明，陳大明',
    draftTitle: '學生會組織章程修正草案',
    mode: '修正',
    rows: [
      { id: 'a', amended: '第三條　本會置會長一人。', current: '第三條　本會置會長一人，副會長一人。', reason: '刪除副會長。' },
      { id: 'b', amended: '', current: '', reason: '' },
    ],
  };
  return d;
}

describe('議案關係文書', () => {
  const texts = (d: OfficialDocument) => buildBlocks(d).map((b) => b.runs.map((r) => r.text).join(''));

  it('follows the council template: title, 案由, proposers, draft table on a new page', () => {
    const d = motionSample();
    const blocks = buildBlocks(d);
    const t = texts(d);
    expect(pageHeader(d)).toBe('學生議會第十四屆');
    expect(t[0]).toBe('學生議會關係文書');
    expect(t[1].startsWith('案由：本會議員')).toBe(true);
    expect(t).toContain('提案人：王小明');
    expect(t).toContain('連署人：王中明　　王大明　　林大明　　林小明');
    expect(t).toContain('陳大明');
    expect(t.some((x) => x.startsWith('受文者') || x.startsWith('發文日期'))).toBe(false);
    const title = blocks.find((b) => b.pageBreakBefore)!;
    expect(title.runs[0].text).toBe('學生會組織章程修正草案');
    const table = blocks.find((b) => b.table)!.table!;
    expect(table.header).toEqual(['修　正　條　文', '現　行　條　文', '說　　　明']);
    expect(table.rows).toEqual([['第三條　本會置會長一人。', '第三條　本會置會長一人，副會長一人。', '刪除副會長。']]);
    expect(blocks.some((b) => b.runs.some((r) => r.text.includes('侯承佑')))).toBe(false);
  });

  it('uses a two-column table for new laws and right-aligns a caucus proposer', () => {
    const d = motionSample();
    d.motion = { ...d.motion, mode: '新訂', proposer: '板中裙眾聯萌黨團', cosigners: '' };
    const blocks = buildBlocks(d);
    expect(blocks.find((b) => b.table)!.table!.rows).toEqual([['第三條　本會置會長一人。', '刪除副會長。']]);
    expect(blocks.find((b) => b.runs[0]?.text === '提案人：板中裙眾聯萌黨團')!.align).toBe('right');
  });

  it('omits the draft page when no draft is attached', () => {
    const d = motionSample();
    d.motion = { ...d.motion, draftTitle: '', rows: [] };
    expect(buildBlocks(d).some((b) => b.pageBreakBefore || b.table)).toBe(false);
  });

  it('exports header, page break and table to ODT and DOCX', async () => {
    const odt = await JSZip.loadAsync(await buildOdt(motionSample()));
    const content = await odt.file('content.xml')!.async('string');
    const styles = await odt.file('styles.xml')!.async('string');
    for (const xml of [content, styles]) {
      const errors: string[] = [];
      new DOMParser({ onError: (_l: string, m: string) => errors.push(m) }).parseFromString(xml, 'text/xml');
      expect(errors).toEqual([]);
    }
    expect(content).toContain('<table:table ');
    expect(content).toContain('fo:break-before="page"');
    expect(styles).toContain('學生議會第十四屆');
    const docx = await JSZip.loadAsync(await (await buildDocx(motionSample())).arrayBuffer());
    const xml = await docx.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:pageBreakBefore/>');
    const headers = Object.keys(docx.files).filter((f) => /word\/header\d*\.xml/.test(f));
    expect(await docx.file(headers[0])!.async('string')).toContain('學生議會第十四屆');
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
    const styles = await zip.file('styles.xml')!.async('string');
    expect(styles).toContain('<text:page-number text:select-page="current">');
    expect(styles).toContain('<text:page-count>');
    expect(styles).toContain('fo:margin-left="2.5cm"');
  });
});

describe('buildDocx', () => {
  it('produces a docx containing the text', async () => {
    const blob = await buildDocx(sample());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('學生選舉委員會');
    expect(xml).toContain('Yuji Boku');
    const footers = Object.keys(zip.files).filter((f) => /word\/footer\d*\.xml/.test(f));
    const footer = await zip.file(footers[0])!.async('string');
    expect(footer).toContain('NUMPAGES');
    expect(footer).toContain('第 ');
  });
});
