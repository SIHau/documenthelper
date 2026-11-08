import type { Urgency } from './types';

/**
 * 公文的辦理期限（依文書處理的慣例）：自收文起算，最速件 1 天、速件 3 天、普通件 6 天（工作天，不含週六日）；
 * 來文寫了「限期」且比較早時，以限期為準。
 * 只排除週六日，國定假日與補假、補班不在計算內，實際期限請以機關的行事曆為準。
 */
export const URGENCY_DAYS: Record<Exclude<Urgency, ''>, number> = { 最速件: 1, 速件: 3, 普通件: 6 };

const DAY = 86400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(iso: string): number | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

function format(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 加 n 個工作天（跳過週六日）；日期格式不正確時回傳空字串。日期以曆日計算，不受時區影響。 */
export function addWorkdays(isoDate: string, n: number): string {
  let t = parse(isoDate);
  if (t === null) return '';
  let left = n;
  while (left > 0) {
    t += DAY;
    const w = new Date(t).getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return format(t);
}

export interface Deadline {
  /** 辦理期限（YYYY-MM-DD） */
  due: string;
  /** 期限依據：速別的工作天，或來文的限期 */
  basis: 'urgency' | 'limit';
  /** 速別對應的工作天數 */
  days: number;
}

/**
 * 辦理期限：從收文日起算。沒有速別時視為普通件；限期較早時以限期為準。
 * 收文日或限期格式不正確時回傳 null / 忽略限期。
 */
export function processDeadline(receivedDate: string, urgency: Urgency, limit = ''): Deadline | null {
  const days = URGENCY_DAYS[urgency === '' ? '普通件' : urgency];
  const byUrgency = addWorkdays(receivedDate, days);
  if (!byUrgency) return null;
  if (parse(limit) !== null && limit < byUrgency) return { due: limit, basis: 'limit', days };
  return { due: byUrgency, basis: 'urgency', days };
}
