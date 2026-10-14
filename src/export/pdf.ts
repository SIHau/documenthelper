import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { OfficialDocument } from '../model/types';
import { BODY_SIZE, PAGE_NUMBER_PARTS, buildBlocks, hasBindingLine, hasPageNumbers, marginXcm, pageHeader } from './layout';
import type { Block, Run, Table } from './layout';
import { findSubset } from './pdfFonts';
import { woffToSfnt } from './woff';
import type { FontFace, PdfFontSet } from './pdfFonts';

const PAGE_W = 595.28; // A4，單位 pt
const PAGE_H = 841.89;
const CM = 28.3465;
const MARGIN_Y = 70.87; // 2.5 cm
const LINE_HEIGHT = 1.6;
const CELL_PAD = 4;
const HEADER_SIZE = 12;
const HEADER_TOP = 42.52; // 1.5 cm
const FOOTER_SIZE = 10;
const FOOTER_BOTTOM = 34; // 頁碼基線距下緣約 1.2 cm
/** 裝訂線距左緣 1.5 cm，「裝」「訂」「線」三字分置 */
const BINDING_X = 1.5 * CM;
const BINDING_LABEL = '裝訂線';
const BINDING_SIZE = 10;

const CLOSING = new Set('，。、；：？！）」』】》,.;:?!)');
const OPENING = new Set('（「『【《(');
const isWordChar = (ch: string) => /[A-Za-z0-9@._\-:/%#&+=~]/.test(ch);

interface Glyph {
  ch: string;
  size: number;
  color: string | undefined;
  /** 字體族群：yuji 簽名字體，缺字時退回宋體 */
  stack: FontFace[];
  font?: PDFFont;
  width: number;
}

interface Line {
  glyphs: Glyph[];
  width: number;
  size: number;
}

export interface PdfResult {
  bytes: Uint8Array;
  /** 任何字體都沒有的字元（未繪製） */
  missing: string[];
}

function stackFor(fonts: PdfFontSet, runFont: string | undefined, bold: boolean | undefined): FontFace[] {
  if (runFont === 'Yuji Boku') return [fonts.yuji, fonts.serifRegular];
  return [bold ? fonts.serifBold : fonts.serifRegular];
}

function hexColor(hex: string | undefined) {
  if (!hex) return rgb(0, 0, 0);
  const n = parseInt(hex, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildPdf(doc: OfficialDocument, fonts: PdfFontSet): Promise<PdfResult> {
  const blocks = buildBlocks(doc);
  const MARGIN_X = marginXcm(doc) * CM;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // 1. 展開成逐字項目，並找出每個字所屬的字體子集
  interface Item extends Glyph {
    file?: string;
    face?: FontFace;
    newline?: boolean;
  }
  const toItems = (runs: Run[]): Item[] =>
    runs.flatMap((r) =>
      [...r.text].map((ch): Item => ({
        ch,
        size: r.size ?? BODY_SIZE,
        color: r.color,
        stack: stackFor(fonts, r.font, r.bold),
        width: 0,
        newline: ch === '\n',
      })),
    );
  const perBlock: Item[][] = blocks.map((b) => toItems(b.runs));
  const headerText = pageHeader(doc);
  const headerItems = headerText ? toItems([{ text: headerText, size: HEADER_SIZE }]) : [];
  // 頁碼與裝訂線用到的字先一起找字體，排版完再逐頁組字
  const footerItems = hasPageNumbers(doc) ? toItems([{ text: PAGE_NUMBER_PARTS.join('') + '0123456789', size: FOOTER_SIZE }]) : [];
  const bindingItems = hasBindingLine(doc) ? toItems([{ text: BINDING_LABEL, size: BINDING_SIZE }]) : [];
  // 表格：每列每格各自一串字元，標題列粗體
  const perCell: Item[][][][] = blocks.map((b) =>
    b.table
      ? [b.table.header, ...b.table.rows].map((row, ri) =>
          row.map((text) => toItems([{ text, size: b.table!.size, bold: ri === 0 && b.table!.header.length > 0 }])),
        )
      : [],
  );

  const missing = new Set<string>();
  const needed = new Map<string, FontFace>();
  for (const items of [...perBlock, ...perCell.flat(2), headerItems, footerItems, bindingItems]) {
    for (const it of items) {
      if (it.newline) continue;
      const cp = it.ch.codePointAt(0)!;
      for (const face of it.stack) {
        const s = findSubset(face, cp);
        if (s) {
          it.file = s.file;
          it.face = face;
          needed.set(s.file, face);
          break;
        }
      }
      if (!it.file) missing.add(it.ch);
    }
  }

  // 2. 載入並嵌入所需子集字體
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embedded = new Map<string, PDFFont>();
  await Promise.all(
    [...needed].map(async ([file, face]) => {
      // Fontsource 提供 WOFF；PDF 只能嵌入 TrueType，需先還原成 SFNT
      const ttf = woffToSfnt(await face.load(file));
      embedded.set(file, await pdf.embedFont(ttf, { subset: true }));
    }),
  );
  pdf.setTitle(doc.subject || doc.type);
  pdf.setProducer('documenthelper');
  pdf.setLanguage('zh-TW');

  // 3. 量測字寬；沒有字體的字元略過
  const measure = (items: Item[]): Item[] =>
    items.filter((it) => it.newline || it.file).map((it) => {
      if (it.newline) return it;
      const font = embedded.get(it.file!)!;
      return { ...it, font, width: font.widthOfTextAtSize(it.ch, it.size) };
    });
  const measured = perBlock.map(measure);
  const measuredCells = perCell.map((rows) => rows.map((row) => row.map(measure)));
  const headerLine = headerItems.length ? wrap(measure(headerItems), () => CONTENT_W)[0] : null;
  const footerGlyphs = new Map(measure(footerItems).map((g) => [g.ch, g]));
  const bindingGlyphs = measure(bindingItems);

  // 4. 排版與繪製
  let page: PDFPage | null = null;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_Y;
    // 頁首置中，距上緣 1.5 cm
    if (headerLine) drawLine(page, headerLine, MARGIN_X + (CONTENT_W - headerLine.width) / 2, PAGE_H - HEADER_TOP - HEADER_SIZE * 0.86);
  };
  newPage();
  if (bindingGlyphs.length) drawBinding(pdf.getPage(0), bindingGlyphs);
  const bottom = MARGIN_Y;

  blocks.forEach((b, bi) => {
    if (b.pageBreakBefore && y < PAGE_H - MARGIN_Y) newPage();
    if (b.table) {
      drawTable(b.table, measuredCells[bi], b.spaceBefore ?? 0);
      return;
    }
    const items = measured[bi];
    if (!items.length) return;
    const em = BODY_SIZE;
    const left = (b.indentEm ?? 0) * em;
    const firstLeft = left - (b.hangingEm ?? 0) * em;
    const centered = b.align === 'right' || b.align === 'center';
    const lines = wrap(items, (isFirst) => (centered ? CONTENT_W : CONTENT_W - (isFirst ? firstLeft : left)));

    let first = true;
    for (const line of lines) {
      const lineH = line.size * LINE_HEIGHT;
      const before = first ? (b.spaceBefore ?? 0) : 0;
      const atTop = y >= PAGE_H - MARGIN_Y;
      if (!atTop && y - before - lineH < bottom) newPage();
      else if (!atTop) y -= before; // 頁首不加段前距
      const baseline = y - (lineH - line.size) / 2 - line.size * 0.86;
      const startX = lineX(b, line, first ? firstLeft : left, MARGIN_X, CONTENT_W);
      drawLine(page!, line, startX, baseline);
      y -= lineH;
      first = false;
    }
  });

  /** 逐列繪製，放不下就換頁並重複標題列 */
  function drawTable(t: Table, cells: Item[][][], spaceBefore: number) {
    const colW = t.columns.map((f) => f * CONTENT_W);
    const lineH = t.size * LINE_HEIGHT;
    const rows = cells.map((row) => row.map((items, c) => wrap(items, () => colW[c] - CELL_PAD * 2)));
    const heightOf = (lines: Line[][], header: boolean) =>
      Math.max(Math.max(...lines.map((l) => l.length)) * lineH + CELL_PAD * 2, header ? 0 : (t.rowHeight ?? 0));
    const drawRow = (lines: Line[][], header: boolean) => {
      const h = heightOf(lines, header);
      let x = MARGIN_X;
      lines.forEach((cellLines, c) => {
        page!.drawRectangle({ x, y: y - h, width: colW[c], height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
        // 置中的內容列也垂直置中
        const textH = cellLines.length * lineH;
        let cy = header || !t.center ? y - CELL_PAD : y - (h - textH) / 2;
        for (const line of cellLines) {
          const baseline = cy - (lineH - t.size) / 2 - t.size * 0.86;
          const lx = header || t.center ? x + (colW[c] - line.width) / 2 : x + CELL_PAD;
          drawLine(page!, line, lx, baseline);
          cy -= lineH;
        }
        x += colW[c];
      });
      y -= h;
    };
    const head = t.header.length ? rows[0] : null;
    const body = rows.slice(1);
    if (y < PAGE_H - MARGIN_Y) y -= spaceBefore;
    const headH = head ? heightOf(head, true) : 0;
    if (y - headH - (body[0] ? heightOf(body[0], false) : 0) < bottom) newPage();
    if (head) drawRow(head, true);
    for (const r of body) {
      if (y - heightOf(r, false) < bottom) {
        newPage();
        if (head) drawRow(head, true);
      }
      drawRow(r, false);
    }
  }

  // 頁尾：第 X 頁 共 Y 頁，置中
  if (footerGlyphs.size) {
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      const text = `${PAGE_NUMBER_PARTS[0]}${i + 1}${PAGE_NUMBER_PARTS[1]}${pages.length}${PAGE_NUMBER_PARTS[2]}`;
      const glyphs = [...text].map((ch) => footerGlyphs.get(ch)).filter((g): g is Glyph => !!g);
      const width = glyphs.reduce((w, g) => w + g.width, 0);
      drawLine(p, { glyphs, width, size: FOOTER_SIZE }, (PAGE_W - width) / 2, FOOTER_BOTTOM);
    });
  }

  return { bytes: await pdf.save(), missing: [...missing] };
}

/** 第一頁左側虛線裝訂線，「裝」「訂」「線」分置上、中、下 */
function drawBinding(page: PDFPage, glyphs: Glyph[]): void {
  const top = PAGE_H - 2.5 * CM;
  const bottom = 2 * CM;
  page.drawLine({
    start: { x: BINDING_X, y: top },
    end: { x: BINDING_X, y: bottom },
    thickness: 0.5,
    dashArray: [1, 2],
    color: rgb(0, 0, 0),
  });
  glyphs.forEach((g, i) => {
    const y = top - ((top - bottom) * (i + 1)) / (glyphs.length + 1);
    // 字蓋在線上，先鋪白底
    page.drawRectangle({ x: BINDING_X - g.width / 2 - 1, y: y - 2, width: g.width + 2, height: g.size + 2, color: rgb(1, 1, 1) });
    drawLine(page, { glyphs: [g], width: g.width, size: g.size }, BINDING_X - g.width / 2, y);
  });
}

function lineX(b: Block, line: Line, leftOffset: number, marginX: number, contentW: number): number {
  if (b.align === 'right') return marginX + contentW - line.width;
  if (b.align === 'center') return marginX + (contentW - line.width) / 2;
  return marginX + leftOffset;
}

function drawLine(page: PDFPage, line: Line, x: number, baseline: number): void {
  let i = 0;
  while (i < line.glyphs.length) {
    const g = line.glyphs[i];
    let text = '';
    let w = 0;
    let j = i;
    // 相同字體、字級、顏色的連續字元合併成一次繪製，方便複製文字
    while (
      j < line.glyphs.length &&
      line.glyphs[j].font === g.font &&
      line.glyphs[j].size === g.size &&
      line.glyphs[j].color === g.color
    ) {
      text += line.glyphs[j].ch;
      w += line.glyphs[j].width;
      j++;
    }
    page.drawText(text, { x, y: baseline, size: g.size, font: g.font!, color: hexColor(g.color) });
    x += w;
    i = j;
  }
}

/** 自動換行：中文逐字斷行、英數詞不拆、標點避頭尾 */
function wrap(items: Glyph[] & Array<{ newline?: boolean }>, widthFor: (isFirst: boolean) => number): Line[] {
  const lines: Line[] = [];
  const defaultSize = items.find((g) => !(g as { newline?: boolean }).newline)?.size ?? BODY_SIZE;

  let cur: Glyph[] = [];
  let curW = 0;
  const flush = () => {
    lines.push({ glyphs: cur, width: curW, size: Math.max(defaultSize, ...cur.map((g) => g.size)) });
    cur = [];
    curW = 0;
  };

  // 切成不可拆的 token
  const tokens: Glyph[][] = [];
  for (let i = 0; i < items.length; ) {
    const g = items[i];
    if ((g as { newline?: boolean }).newline) {
      tokens.push([g]);
      i++;
    } else if (isWordChar(g.ch)) {
      let j = i;
      while (j < items.length && !(items[j] as { newline?: boolean }).newline && isWordChar(items[j].ch)) j++;
      tokens.push(items.slice(i, j));
      i = j;
    } else {
      tokens.push([g]);
      i++;
    }
  }

  for (const tok of tokens) {
    if ((tok[0] as { newline?: boolean }).newline) {
      flush();
      continue;
    }
    const tw = tok.reduce((s, g) => s + g.width, 0);
    const avail = widthFor(lines.length === 0);
    const fits = curW + tw <= avail + 0.01;
    const hangs = tok.length === 1 && CLOSING.has(tok[0].ch); // 句末標點允許懸在行尾
    if (!fits && cur.length && !hangs) {
      // 行尾不留開括號
      const last = cur[cur.length - 1];
      let carry: Glyph[] = [];
      if (OPENING.has(last.ch)) {
        carry = [cur.pop()!];
        curW -= last.width;
      }
      flush();
      for (const c of carry) {
        cur.push(c);
        curW += c.width;
      }
    }
    // 單一 token 比整行還寬（例如很長的網址）：逐字放
    if (tw > widthFor(lines.length === 0) && tok.length > 1) {
      for (const g of tok) {
        if (curW + g.width > widthFor(lines.length === 0) && cur.length) flush();
        cur.push(g);
        curW += g.width;
      }
    } else {
      for (const g of tok) {
        cur.push(g);
        curW += g.width;
      }
    }
  }
  if (cur.length || !lines.length) flush();
  return lines;
}
