import type { DocType } from './types';

/** 學生議會發文字號一覽 */
export const COUNCIL_WORDS = ['議字', '議令字', '議佈字', '議秘字', '議通字', '議件字'] as const;

/** 依文種與發文機關推定字別；秘書長發文用議秘字 */
export function defaultWord(type: DocType, senderName: string): string {
  if (type === '令') return '議令字';
  if (type === '公告') return '議佈字';
  if (type === '開會通知單') return '議通字';
  if (type === '催辦案件通知單') return '議件字';
  return /秘書長/.test(senderName) ? '議秘字' : '議字';
}

/**
 * 發文字號：{字}第{民國年 3 碼}{月日 4 碼}{當日流水號 3 碼}號，例：議字第1151014001號。
 * 流水號取同字別、同日期已用字號的最大值加一。
 */
export function nextDocNumber(word: string, isoDate: string, used: string[]): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return '';
  const prefix = `${String(Number(m[1]) - 1911).padStart(3, '0')}${m[2]}${m[3]}`;
  const pattern = new RegExp(`^${word}第${prefix}(\\d{3})號$`);
  const max = used.reduce((n, u) => {
    const hit = pattern.exec(u.replace(/\s/g, ''));
    return hit ? Math.max(n, Number(hit[1])) : n;
  }, 0);
  return `${word}第${prefix}${String(max + 1).padStart(3, '0')}號`;
}
