/** 金額字串轉數字（可含千分位逗號與「元」）；空白或無法辨識時回傳 null */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[,，\s元]/g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

export const formatAmount = (n: number) => n.toLocaleString('en-US');
