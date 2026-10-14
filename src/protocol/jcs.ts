/**
 * RFC 8785 JSON Canonicalization Scheme（JCS）。
 * 簽章與 hash 一律以這個格式計算，不同平台、不同語言才會得到相同位元組。
 * 只接受 JSON 能表示的值；undefined、NaN、Infinity 與非純物件會直接拋錯，避免靜默產生不同結果。
 */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS 不接受 NaN 或 Infinity');
    // ECMAScript 的數字字串化即 RFC 8785 規定的格式
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    // 依 UTF-16 code unit 排序鍵名（JavaScript 預設排序即是）；值為 undefined 的鍵視為不存在
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }
  throw new Error(`JCS 不接受這種值：${typeof value}`);
}
