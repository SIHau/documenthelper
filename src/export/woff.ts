import { unzlibSync } from 'fflate';

const u32 = (v: DataView, o: number) => v.getUint32(o, false);

/**
 * WOFF 1.0 → SFNT（TrueType）。PDF 只能嵌入 SFNT，不能直接嵌入 WOFF。
 * WOFF 每個資料表以 zlib 壓縮（壓縮後較大時則存原始資料）；這裡逐表還原並重建表目錄。
 */
export function woffToSfnt(woff: Uint8Array): Uint8Array {
  const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (u32(v, 0) !== 0x774f4646) throw new Error('不是 WOFF 字體檔');
  const flavor = u32(v, 4);
  const numTables = v.getUint16(12, false);

  interface Table { tag: number; checksum: number; data: Uint8Array }
  const tables: Table[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const offset = u32(v, e + 4);
    const compLength = u32(v, e + 8);
    const origLength = u32(v, e + 12);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? unzlibSync(raw) : raw.slice();
    if (data.length !== origLength) throw new Error('WOFF 資料表長度不符');
    tables.push({ tag: u32(v, e), checksum: u32(v, e + 16), data });
  }

  // SFNT 表目錄須依 tag 排序
  tables.sort((a, b) => a.tag - b.tag);
  const headerSize = 12 + numTables * 16;
  const total = tables.reduce((s, t) => s + ((t.data.length + 3) & ~3), headerSize);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= numTables) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;
  dv.setUint32(0, flavor, false);
  dv.setUint16(4, numTables, false);
  dv.setUint16(6, searchRange, false);
  dv.setUint16(8, entrySelector, false);
  dv.setUint16(10, numTables * 16 - searchRange, false);

  let pos = headerSize;
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    dv.setUint32(r, t.tag, false);
    dv.setUint32(r + 4, t.checksum, false);
    dv.setUint32(r + 8, pos, false);
    dv.setUint32(r + 12, t.data.length, false);
    out.set(t.data, pos);
    pos += (t.data.length + 3) & ~3;
  });
  return out;
}
