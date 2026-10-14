import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import { emptyDocument, newItem } from '../model/defaults';
import { buildPdf } from './pdf';
import { findSubset, parseFontCss } from './pdfFonts';
import type { FontFace, PdfFontSet } from './pdfFonts';

const require_ = createRequire(import.meta.url);
function face(pkg: string, weight: number): FontFace {
  const dir = require_.resolve(`${pkg}/package.json`).replace(/package\.json$/, '');
  return {
    subsets: parseFontCss(readFileSync(`${dir}${weight}.css`, 'utf8')),
    load: async (file) => new Uint8Array(readFileSync(`${dir}files/${file}`)),
  };
}
const fonts: PdfFontSet = {
  serifRegular: face('@fontsource/noto-serif-tc', 400),
  serifBold: face('@fontsource/noto-serif-tc', 700),
  yuji: face('@fontsource/yuji-boku', 400),
};

function sample() {
  const d = emptyDocument();
  d.date = '2025-03-20';
  d.sender.name = '學生議會侯承佑議員';
  d.recipient.name = '學生選舉委員會';
  d.subject = '有關提供學生會長選舉預計日程一案，請查照。';
  d.contact = { person: '侯承佑', phone: '02-12345678', email: '410242@mail.pcsh.ntpc.edu.tw', fax: '' };
  d.explanation = [newItem(0, '依往例學生會長選舉將至，請選舉委員會提供會長選舉預計日程。'), newItem(1, '預計日程不必為最終定案，得視情況調整。')];
  d.signature = { enabled: true, title: '學生議員', name: '侯承佑', font: 'yuji-boku' };
  return d;
}

describe('parseFontCss / findSubset', () => {
  it('maps characters to subset files', () => {
    const f = fonts.serifRegular;
    expect(f.subsets.length).toBeGreaterThan(50);
    expect(findSubset(f, '學'.codePointAt(0)!)).toBeTruthy();
    expect(findSubset(f, 'A'.codePointAt(0)!)).toBeTruthy();
    expect(findSubset(f, 0x1f600)).toBeUndefined();
  });
});

describe('buildPdf', () => {
  it('produces a valid one-page A4 PDF', async () => {
    const { bytes, missing } = await buildPdf(sample(), fonts);
    expect(missing).toEqual([]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(pdf.getTitle()).toBe('有關提供學生會長選舉預計日程一案，請查照。');
  }, 30000);

  it('reports unsupported characters and paginates long text', async () => {
    const d = sample();
    d.explanation = Array.from({ length: 60 }, (_, i) => newItem(0, `第${i}項說明，內容較長以便觸發換行與換頁。`.repeat(3) + '😀'));
    const { bytes, missing } = await buildPdf(d, fonts);
    expect(missing).toContain('😀');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  }, 60000);

  it('prints the 開會通知單 agenda on page 2', async () => {
    const d = { ...sample(), type: '開會通知單' as const };
    d.meeting = { ...d.meeting, reason: '法制委員會會議', time: '114年4月1日', place: '會議室', agenda: '第十五屆學生議會' };
    d.explanation = [newItem(0, '主席報告。')];
    const { bytes, missing } = await buildPdf(d, fonts);
    expect(missing).toEqual([]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  }, 30000);

  it('draws the motion header, draft page and repeats the table header across pages', async () => {
    const d = { ...sample(), type: '議案關係文書' as const, subject: '擬具草案，是否有當？敬請公決。' };
    d.motion = {
      ...d.motion,
      term: '十四',
      proposer: '王小明',
      cosigners: '王中明 王大明',
      draftTitle: '學生會組織章程修正草案',
      mode: '修正',
      rows: Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        amended: `第${i + 1}條　本會置會長一人，綜理會務，對外代表本會。`,
        current: `第${i + 1}條　本會置會長一人。`,
        reason: '明定會長職權。',
      })),
    };
    const { bytes, missing } = await buildPdf(d, fonts);
    expect(missing).toEqual([]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  }, 60000);
});
