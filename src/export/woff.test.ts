import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { woffToSfnt } from './woff';

const path = 'node_modules/@fontsource/noto-serif-tc/files/noto-serif-tc-12-400-normal.woff';

describe('woffToSfnt', () => {
  it('rebuilds a TrueType font that fontkit can read', () => {
    const sfnt = woffToSfnt(new Uint8Array(readFileSync(path)));
    expect([...sfnt.slice(0, 4)]).toEqual([0, 1, 0, 0]);
    const font = fontkit.create(sfnt as never) as { numGlyphs: number; postscriptName: string };
    expect(font.numGlyphs).toBeGreaterThan(10);
    expect(font.postscriptName).toContain('NotoSerifTC');
  });
  it('rejects non-WOFF input', () => {
    expect(() => woffToSfnt(new Uint8Array(64))).toThrow('WOFF');
  });
});
