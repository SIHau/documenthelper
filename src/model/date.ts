/** 西元 YYYY-MM-DD → 中華民國114年9月29日；格式不符時回傳空字串 */
export function toMinguoText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const year = Number(m[1]) - 1911;
  if (year < 1) return '';
  return `中華民國${year}年${Number(m[2])}月${Number(m[3])}日`;
}

export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
