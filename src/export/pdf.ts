import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { OfficialDocument } from '../model/types';
import { BODY_SIZE, buildBlocks } from './layout';
import type { Block } from './layout';
import { findSubset } from './pdfFonts';
import { woffToSfnt } from './woff';
import type { FontFace, PdfFontSet } from './pdfFonts';

const PAGE_W = 595.28; // A4，單位 pt
const PAGE_H = 841.89;
const MARGIN_X = 56.69; // 2 cm
const MARGIN_Y = 70.87; // 2.5 cm
const LINE_HEIGHT = 1.6;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

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

  // 1. 展開成逐字項目，並找出每個字所屬的字體子集
  interface Item extends Glyph {
    file?: string;
    face?: FontFace;
    newline?: boolean;
  }
  const perBlock: Item[][] = blocks.map((b) =>
    b.runs.flatMap((r) =>
      [...r.text].map((ch): Item => ({
        ch,
        size: r.size ?? BODY_SIZE,
        color: r.color,
        stack: stackFor(fonts, r.font, r.bold),
        width: 0,
        newline: ch === '\n',
      })),
    ),
  );

  const missing = new Set<string>();
  const needed = new Map<string, FontFace>();
  for (const items of perBlock) {
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
  const measured: Item[][] = perBlock.map((items) =>
    items.filter((it) => it.newline || it.file).map((it) => {
      if (it.newline) return it;
      const font = embedded.get(it.file!)!;
      return { ...it, font, width: font.widthOfTextAtSize(it.ch, it.size) };
    }),
  );

  // 4. 排版與繪製
  let page: PDFPage | null = null;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_Y;
  };
  newPage();
  const bottom = MARGIN_Y;

  blocks.forEach((b, bi) => {
    const items = measured[bi];
    if (!items.length) return;
    const em = BODY_SIZE;
    const left = (b.indentEm ?? 0) * em;
    const firstLeft = left - (b.hangingEm ?? 0) * em;
    const lines = wrap(items, b, firstLeft, left);

    let first = true;
    for (const line of lines) {
      const lineH = line.size * LINE_HEIGHT;
      const before = first ? (b.spaceBefore ?? 0) : 0;
      const atTop = y >= PAGE_H - MARGIN_Y;
      if (!atTop && y - before - lineH < bottom) newPage();
      else if (!atTop) y -= before; // 頁首不加段前距
      const baseline = y - (lineH - line.size) / 2 - line.size * 0.86;
      const startX = lineX(b, line, first ? firstLeft : left);
      drawLine(page!, line, startX, baseline);
      y -= lineH;
      first = false;
    }
  });

  return { bytes: await pdf.save(), missing: [...missing] };
}

function lineX(b: Block, line: Line, leftOffset: number): number {
  if (b.align === 'right') return MARGIN_X + CONTENT_W - line.width;
  if (b.align === 'center') return MARGIN_X + (CONTENT_W - line.width) / 2;
  return MARGIN_X + leftOffset;
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
function wrap(items: Glyph[] & Array<{ newline?: boolean }>, b: Block, firstLeft: number, left: number): Line[] {
  const lines: Line[] = [];
  const widthFor = (isFirst: boolean) =>
    b.align === 'right' || b.align === 'center' ? CONTENT_W : CONTENT_W - (isFirst ? firstLeft : left);
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
