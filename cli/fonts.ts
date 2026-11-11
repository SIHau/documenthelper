import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseFontCss } from '../src/export/pdfFonts';
import type { FontFace, PdfFontSet } from '../src/export/pdfFonts';

const require_ = createRequire(import.meta.url);

/** 讀 node_modules 裡 Fontsource 的字體檔（需先在專案根目錄執行 npm ci） */
function face(pkg: string, weight: number): FontFace {
  let dir: string;
  try {
    dir = require_.resolve(`${pkg}/package.json`).replace(/package\.json$/, '');
  } catch {
    throw new Error(`找不到字體套件 ${pkg}，請先在公文小幫手專案根目錄執行 npm ci`);
  }
  return {
    subsets: parseFontCss(readFileSync(`${dir}${weight}.css`, 'utf8')),
    load: async (file) => new Uint8Array(readFileSync(`${dir}files/${file}`)),
  };
}

/** PDF 用字體：本文思源宋體（一般、粗體），簽名 Yuji Boku */
export function nodePdfFonts(): PdfFontSet {
  return {
    serifRegular: face('@fontsource/noto-serif-tc', 400),
    serifBold: face('@fontsource/noto-serif-tc', 700),
    yuji: face('@fontsource/yuji-boku', 400),
  };
}
