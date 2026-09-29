import type { Agency } from './types';
import { newId } from '../model/defaults';

export const CSV_HEADERS = ['名稱', '代碼', '地址', '電話', '傳真', '電子信箱', '備註'] as const;

function quote(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 輸出含 BOM 的 CSV，Excel 開啟中文才不會亂碼 */
export function agenciesToCsv(list: Agency[]): string {
  const rows = list.map((a) => [a.name, a.code, a.address, a.phone, a.fax, a.email, a.note].map(quote).join(','));
  return '﻿' + [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** 簡易 CSV 解析：支援雙引號、引號內逗號與換行、"" 跳脫 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** CSV → 通訊錄項目。第一列必須是標題列（至少含「名稱」）。 */
export function csvToAgencies(text: string): Agency[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('檔案是空的');
  const col = (name: string) => header.findIndex((h) => h.trim() === name);
  const nameCol = col('名稱');
  if (nameCol < 0) throw new Error('找不到「名稱」欄，請確認第一列是標題列');
  const idx = Object.fromEntries(CSV_HEADERS.map((h) => [h, col(h)]));
  const get = (r: string[], h: (typeof CSV_HEADERS)[number]) => (idx[h] >= 0 ? (r[idx[h]] ?? '').trim() : '');
  return rows
    .filter((r) => (r[nameCol] ?? '').trim())
    .map((r) => ({
      id: newId(),
      name: get(r, '名稱'),
      code: get(r, '代碼'),
      address: get(r, '地址'),
      phone: get(r, '電話'),
      fax: get(r, '傳真'),
      email: get(r, '電子信箱'),
      note: get(r, '備註'),
    }));
}

/** 匯入合併：名稱相同者更新內容（保留原 id），其餘新增 */
export function mergeAgencies(existing: Agency[], incoming: Agency[]): { merged: Agency[]; added: number; updated: number } {
  const byName = new Map(existing.map((a) => [a.name.trim(), a]));
  const changed: Agency[] = [];
  let added = 0;
  let updated = 0;
  for (const a of incoming) {
    const hit = byName.get(a.name.trim());
    if (hit) {
      changed.push({ ...a, id: hit.id });
      updated++;
    } else {
      changed.push(a);
      byName.set(a.name.trim(), a);
      added++;
    }
  }
  return { merged: changed, added, updated };
}

export function emptyAgency(): Agency {
  return { id: newId(), name: '', code: '', address: '', phone: '', fax: '', email: '', note: '' };
}
