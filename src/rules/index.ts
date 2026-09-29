import type { OfficialDocument, OutlineItem } from '../model/types';
import { DOC_TYPES } from '../model/docTypes';
import { toMinguoText } from '../model/date';
import { DOWNWARD_ONLY, NOT_UPWARD, UPWARD_ONLY } from '../data/phrases';
import { COLLOQUIAL } from './colloquial';

export type Severity = 'error' | 'warn' | 'info';

export interface Issue {
  id: string;
  severity: Severity;
  /** 問題所在的欄位名稱，顯示用 */
  where: string;
  message: string;
}

const ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
const SUBJECT_MAX = 60;
const END_PUNCT = '。；：？！）)」』';

const hasText = (s: string) => s.trim().length > 0;

interface Section {
  where: string;
  text: string;
}

function outlineSections(label: string | null, items: OutlineItem[]): Section[] {
  if (!label) return [];
  return items.filter((i) => hasText(i.text)).map((i) => ({ where: label, text: i.text }));
}

export function checkDocument(doc: OfficialDocument): Issue[] {
  const cfg = DOC_TYPES[doc.type];
  const issues: Issue[] = [];
  const add = (id: string, severity: Severity, where: string, message: string) =>
    issues.push({ id, severity, where, message });

  const sections: Section[] = [
    ...(cfg.subject ? [{ where: '主旨', text: doc.subject }] : []),
    ...outlineSections(cfg.explanationLabel, doc.explanation),
    ...outlineSections(cfg.measuresLabel, doc.measures),
  ];
  const body = sections.map((s) => s.text).join('\n');

  // 必填欄位
  if (!hasText(doc.sender.name)) add('sender', 'error', '發文機關', '尚未填寫發文機關。');
  if (cfg.recipient && !hasText(doc.recipient.name)) {
    add('recipient', 'error', cfg.recipientLabel, `尚未填寫${cfg.recipientLabel}。`);
  }
  if (!toMinguoText(doc.date)) add('date', 'error', cfg.dateLabel, `${cfg.dateLabel}格式不正確。`);
  if (cfg.subject && !hasText(doc.subject)) add('subject-empty', 'error', '主旨', '尚未填寫主旨。');
  if (cfg.docNumber && !hasText(doc.docNumber)) add('docnum', 'info', '發文字號', '尚未填寫發文字號。');
  if (cfg.meeting) {
    if (!hasText(doc.meeting.reason)) add('m-reason', 'error', '開會事由', '尚未填寫開會事由。');
    if (!hasText(doc.meeting.time)) add('m-time', 'error', '開會時間', '尚未填寫開會時間。');
    if (!hasText(doc.meeting.place)) add('m-place', 'error', '開會地點', '尚未填寫開會地點。');
  }
  if (doc.type === '公告' && !doc.measures.some((i) => hasText(i.text))) {
    add('announce', 'error', '公告事項', '尚未填寫公告事項。');
  }
  if (doc.type === '簽' && !doc.measures.some((i) => hasText(i.text))) {
    add('plan', 'warn', '擬辦', '簽通常需寫明擬辦事項。');
  }
  if (doc.signature.enabled && hasText(doc.signature.title) && !hasText(doc.signature.name)) {
    add('sign-name', 'warn', '簽名', '已填頭銜但未填姓名。');
  }
  if (hasText(doc.contact.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.contact.email.trim())) {
    add('email', 'warn', '電子信箱', '電子信箱格式看起來不正確。');
  }

  // 主旨
  if (cfg.subject && hasText(doc.subject)) {
    const subject = doc.subject.trim();
    if (subject.length > SUBJECT_MAX) {
      add('subject-long', 'info', '主旨', `主旨共 ${subject.length} 字，建議力求簡明（約 ${SUBJECT_MAX} 字內）。`);
    }
    if (!/[。]$/.test(subject)) add('subject-period', 'info', '主旨', '主旨結尾建議加上句號。');
    if (cfg.expectation && !/(請|敬請|謹請|函請)[^，。；：]*。?$/.test(subject)) {
      add('subject-expect', 'warn', '主旨', '主旨結尾缺少期望語（如：請查照、請鑒核）。');
    }
  }

  // 行文方向與期望語
  if (cfg.expectation && hasText(doc.subject)) {
    const hit = (list: string[]) => list.filter((p) => doc.subject.includes(p));
    const wrong =
      doc.direction === '上行'
        ? hit([...NOT_UPWARD, ...DOWNWARD_ONLY])
        : doc.direction === '平行'
          ? hit([...UPWARD_ONLY, ...DOWNWARD_ONLY])
          : hit(UPWARD_ONLY);
    if (wrong.length) {
      add('direction', 'warn', '主旨', `${doc.direction}文不宜使用「${[...new Set(wrong)].join('」「')}」，請確認行文方向或期望語。`);
    }
  }

  // 附件
  const mentionsAttachment = /附件|如附|檢附|檢送|隨函/.test(body);
  const hasAttachment = hasText(doc.attachments) && !/^(無|无)$/.test(doc.attachments.trim());
  if (mentionsAttachment && !hasAttachment) {
    add('att-missing', 'warn', '附件', '內文提到附件，但「附件」欄為空或填「無」。');
  }
  if (hasAttachment && !mentionsAttachment) {
    add('att-unmentioned', 'info', '附件', '附件欄已填寫，但主旨或內文未提及附件。');
  }

  // 內文逐段檢查
  for (const s of sections) {
    if (/(?:19|20)\d{2}\s*年/.test(s.text)) {
      add(`west-year:${s.where}`, 'warn', s.where, '公文日期請使用民國紀年，不宜使用西元年。');
    }
    for (const c of COLLOQUIAL) {
      if (s.text.includes(c.word)) {
        add(`colloquial:${c.word}:${s.where}`, 'info', s.where, `「${c.word}」偏口語，可改用「${c.suggest}」。`);
      }
    }
  }
  for (const [label, items] of [
    [cfg.explanationLabel, doc.explanation],
    [cfg.measuresLabel, doc.measures],
  ] as const) {
    if (!label) continue;
    if (items.some((i) => !hasText(i.text)) && items.some((i) => hasText(i.text))) {
      add(`empty-item:${label}`, 'warn', label, '有空白的分項，匯出時會被略過。');
    }
    if (items.some((i) => hasText(i.text) && !END_PUNCT.includes(i.text.trim().slice(-1)))) {
      add(`item-punct:${label}`, 'info', label, '部分分項結尾缺少標點（。；：）。');
    }
  }

  return issues.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
