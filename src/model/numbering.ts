import type { OutlineItem } from './types';

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 1–99 轉中文數字：十、十一、二十、二十一 */
export function toChineseNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens === 1 ? '' : DIGITS[tens]) + '十' + (ones ? DIGITS[ones] : '');
}

const HEAVENLY = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 各層級標號：一、／(一)／1、／(1)／甲、／(甲) */
const FORMATTERS: Array<(n: number) => string> = [
  (n) => `${toChineseNumber(n)}、`,
  (n) => `(${toChineseNumber(n)})`,
  (n) => `${n}、`,
  (n) => `(${n})`,
  (n) => `${HEAVENLY[(n - 1) % HEAVENLY.length]}、`,
  (n) => `(${HEAVENLY[(n - 1) % HEAVENLY.length]})`,
];

export const MAX_LEVEL = FORMATTERS.length - 1;

export function formatLabel(level: number, n: number): string {
  return FORMATTERS[Math.min(Math.max(level, 0), MAX_LEVEL)](n);
}

export interface NumberedItem extends OutlineItem {
  label: string;
}

/**
 * 依層級自動編號。
 * 規則：進入較深層時從 1 起算；回到較淺層時繼續該層計數並重設更深層。
 * 首項若不是第 0 層，視為被提升到合理的深度（不允許跳級，最多比前一項深一層）。
 */
export function numberItems(items: OutlineItem[]): NumberedItem[] {
  const counters: number[] = [];
  let prevLevel = -1;
  return items.map((item) => {
    const level = Math.min(Math.max(item.level, 0), Math.min(prevLevel + 1, MAX_LEVEL));
    counters.length = level + 1;
    counters[level] = (counters[level] ?? 0) + 1;
    prevLevel = level;
    return { ...item, level, label: formatLabel(level, counters[level]) };
  });
}
