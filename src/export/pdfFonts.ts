/**
 * PDF 字體：以 Fontsource 提供的子集字體檔（依 unicode-range 分檔）嵌入 PDF。
 * 本檔為與環境無關的邏輯；實際讀檔方式（瀏覽器 fetch／測試用 fs）由 loader 注入。
 */

export interface Subset {
  /** 檔名，例：noto-serif-tc-12-400-normal.woff */
  file: string;
  ranges: Array<[number, number]>;
}

export type FontLoader = (file: string) => Promise<Uint8Array>;

export interface FontFace {
  subsets: Subset[];
  load: FontLoader;
}

export interface PdfFontSet {
  serifRegular: FontFace;
  serifBold: FontFace;
  yuji: FontFace;
}

/** 解析 Fontsource CSS 內每個 @font-face 的 woff 檔名與 unicode-range */
export function parseFontCss(css: string): Subset[] {
  const out: Subset[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const file = /url\(\.\/files\/([^)]+\.woff)\)/.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
    if (!file || !range) continue;
    const ranges: Array<[number, number]> = [];
    for (const part of range.split(',')) {
      const m = /U\+([0-9a-fA-F]+)(?:-([0-9a-fA-F]+))?/.exec(part.trim());
      if (!m) continue;
      const lo = parseInt(m[1], 16);
      ranges.push([lo, m[2] ? parseInt(m[2], 16) : lo]);
    }
    out.push({ file, ranges });
  }
  return out;
}

export function findSubset(face: FontFace, cp: number): Subset | undefined {
  return face.subsets.find((s) => s.ranges.some(([lo, hi]) => cp >= lo && cp <= hi));
}
