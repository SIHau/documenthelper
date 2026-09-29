import serifRegularCss from '@fontsource/noto-serif-tc/400.css?raw';
import serifBoldCss from '@fontsource/noto-serif-tc/700.css?raw';
import yujiCss from '@fontsource/yuji-boku/400.css?raw';
import { parseFontCss } from './pdfFonts';
import type { FontFace, PdfFontSet } from './pdfFonts';

// 只收集會用到的字重，避免把 Fontsource 全部檔案都打包進來
const urlLoaders = import.meta.glob(
  [
    '/node_modules/@fontsource/noto-serif-tc/files/*-400-normal.woff',
    '/node_modules/@fontsource/noto-serif-tc/files/*-700-normal.woff',
    '/node_modules/@fontsource/yuji-boku/files/*-400-normal.woff',
  ],
  { query: '?url', import: 'default' },
) as Record<string, () => Promise<string>>;

const byName = new Map(Object.entries(urlLoaders).map(([path, fn]) => [path.split('/').pop()!, fn]));

async function load(file: string): Promise<Uint8Array> {
  const get = byName.get(file);
  if (!get) throw new Error(`找不到字體檔：${file}`);
  const res = await fetch(await get());
  if (!res.ok) throw new Error(`字體檔下載失敗：${file}`);
  return new Uint8Array(await res.arrayBuffer());
}

const face = (css: string): FontFace => ({ subsets: parseFontCss(css), load });

export function browserPdfFonts(): PdfFontSet {
  return { serifRegular: face(serifRegularCss), serifBold: face(serifBoldCss), yuji: face(yujiCss) };
}
