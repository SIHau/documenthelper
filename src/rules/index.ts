import type { OfficialDocument, OutlineItem } from '../model/types';
import { DOC_TYPES } from '../model/docTypes';
import { toMinguoText } from '../model/date';
import { DOWNWARD_ONLY, NOT_UPWARD, UPWARD_ONLY } from '../data/phrases';
import { COLLOQUIAL } from './colloquial';
import { parseAmount } from '../model/amount';

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
    ...(cfg.subject ? [{ where: cfg.subjectLabel, text: doc.subject }] : []),
    ...outlineSections(cfg.explanationLabel, doc.explanation),
    ...outlineSections(cfg.measuresLabel, doc.measures),
  ];
  const body = sections.map((s) => s.text).join('\n');

  // 必填欄位
  if (cfg.letterhead && !hasText(doc.sender.name)) add('sender', 'error', '發文機關', '尚未填寫發文機關。');
  if (cfg.recipient && cfg.recipientRequired && !hasText(doc.recipient.name)) {
    add('recipient', 'error', cfg.recipientLabel, `尚未填寫${cfg.recipientLabel}。`);
  }
  if (cfg.letterhead && !toMinguoText(doc.date)) add('date', 'error', cfg.dateLabel, `${cfg.dateLabel}格式不正確。`);
  if (cfg.subject && cfg.subjectRequired && !hasText(doc.subject)) add('subject-empty', 'error', cfg.subjectLabel, `尚未填寫${cfg.subjectLabel}。`);
  if (cfg.subject && !cfg.subjectRequired && !hasText(doc.subject) && !doc.explanation.some((i) => hasText(i.text))) {
    add('body-empty', 'error', '本文', '尚未填寫主旨或本文。');
  }
  if (cfg.docNumber && !hasText(doc.docNumber)) add('docnum', 'info', '發文字號', '尚未填寫發文字號。');
  if (cfg.meeting) {
    if (!hasText(doc.meeting.reason)) add('m-reason', 'error', '開會事由', '尚未填寫開會事由。');
    if (!hasText(doc.meeting.time)) add('m-time', 'error', '開會時間', '尚未填寫開會時間。');
    if (!hasText(doc.meeting.place)) add('m-place', 'error', '開會地點', '尚未填寫開會地點。');
  }
  if (doc.type === '簽' && !doc.measures.some((i) => hasText(i.text))) {
    add('plan', 'warn', '擬辦', '簽通常需寫明擬辦事項。');
  }
  if (cfg.motion) {
    const m = doc.motion;
    const where = '提案人與連署人';
    if (!hasText(m.term)) add('motion-term', 'warn', '屆別', '尚未填寫屆別，頁首會顯示「學生議會第○屆」。');
    if (!hasText(m.proposer)) add('motion-proposer', 'error', where, '尚未填寫提案人。');
    const cosigners = m.cosigners.split(/[\s、，,]+/).filter(Boolean);
    if (cosigners.length === 1) add('motion-cosigners', 'warn', where, '議員提案須三人以上（提案人連同連署人），目前只有一位連署人。');
    if (hasText(doc.subject) && !/公決/.test(doc.subject)) {
      add('motion-ending', 'info', '案由', '案由結尾通常為「是否有當？敬請公決。」');
    }
    const table = '草案對照表';
    const filled = m.rows.filter((r) => hasText(r.amended) || hasText(r.current) || hasText(r.reason));
    if (filled.length && !hasText(m.draftTitle)) add('draft-title', 'error', table, '尚未填寫草案名稱。');
    if (hasText(m.draftTitle) && !filled.length) add('draft-rows', 'error', table, '草案對照表沒有任何條文。');
    filled.forEach((r, i) => {
      const n = `第 ${i + 1} 列`;
      if (m.mode === '新訂' ? !hasText(r.amended) : !hasText(r.amended) && !hasText(r.current)) {
        add(`draft-text:${r.id}`, 'error', table, m.mode === '新訂' ? `${n}尚未填寫條文。` : `${n}的修正條文與現行條文都是空白。`);
      }
      if (!hasText(r.reason)) add(`draft-reason:${r.id}`, 'warn', table, `${n}尚未填寫說明。`);
      if (m.mode === '修正' && hasText(r.amended) && r.amended.trim() === r.current.trim()) {
        add(`draft-same:${r.id}`, 'warn', table, `${n}的修正條文與現行條文相同。`);
      }
    });
  }
  if (cfg.senderOnly && !hasText(doc.sender.name)) add('sender', 'error', '機關', '尚未填寫機關名稱。');
  if (cfg.layout === 'minutes' || cfg.layout === 'signin') {
    if (!hasText(doc.meeting.reason)) add('m-reason', 'error', '會議資訊', '尚未填寫會議名稱。');
    if (!hasText(doc.meeting.time)) add('m-time', 'warn', '會議資訊', cfg.layout === 'minutes' ? '尚未填寫開會時間。' : '尚未填寫會議日期。');
  }
  if (cfg.layout === 'minutes') {
    if (!hasText(doc.meeting.chair)) add('m-chair', 'warn', '會議資訊', '尚未填寫主席。');
    if (!hasText(doc.meeting.recorder)) add('m-recorder', 'warn', '會議資訊', '尚未填寫記錄人員。');
    doc.minutes.cases.forEach((c, i) => {
      if ((hasText(c.subject) || hasText(c.explanation)) && !hasText(c.resolution)) {
        add(`case-resolution:${c.id}`, 'warn', '討論事項', `第${i + 1}案尚未填寫決議。`);
      }
    });
  }
  if (cfg.layout === 'budget') {
    const b = doc.budget;
    const where = '概算書';
    if (!hasText(b.year)) add('budget-year', 'error', where, '尚未填寫學年度。');
    const items = b.items.filter((it) => hasText(it.name) || hasText(it.amount) || hasText(it.note));
    if (!items.length) add('budget-items', 'error', '貳、概算案', '概算表沒有任何項目。');
    items.forEach((it, i) => {
      if (!hasText(it.amount)) add(`budget-amount:${it.id}`, 'warn', '貳、概算案', `第 ${i + 1} 項尚未填寫費用。`);
      else if (parseAmount(it.amount) === null) add(`budget-amount:${it.id}`, 'error', '貳、概算案', `第 ${i + 1} 項的費用「${it.amount}」不是數字，不會計入合計。`);
    });
    for (const [label, text] of [['現行法定掌職', b.duties], ['內部分層業務', b.divisions], ['設立概算目的', b.purpose]] as const) {
      if (!hasText(text)) add(`budget-text:${label}`, 'warn', '壹、前言', `尚未填寫${label}。`);
    }
  }
  if (cfg.layout === 'correction' && !hasText(doc.motion.proposer)) add('motion-proposer', 'error', '提案議員', '尚未填寫提案議員。');
  if (cfg.layout === 'review') {
    const table = '審查報告對照表';
    const names = doc.motion.proposalNames.filter(hasText);
    if (!hasText(doc.motion.draftTitle)) add('draft-title', 'error', table, '尚未填寫法規與草案名稱。');
    if (!hasText(doc.motion.reviewer)) add('review-reviewer', 'warn', table, '尚未填寫審查會，表頭會顯示「○○委員會通過條文」。');
    if (!names.length) add('review-proposals', 'warn', table, '尚未填寫併案審查的提案，表格只會有通過條文、現行條文與說明三欄。');
    const filled = doc.motion.rows.filter((r) => hasText(r.amended) || hasText(r.current) || hasText(r.reason));
    if (!filled.length) add('draft-rows', 'error', table, '對照表沒有任何條文。');
    filled.forEach((r, i) => {
      if (!hasText(r.reason)) add(`draft-reason:${r.id}`, 'warn', table, `第 ${i + 1} 列尚未填寫說明。`);
    });
  }
  if (cfg.letterhead && doc.signature.enabled && hasText(doc.signature.title) && !hasText(doc.signature.name)) {
    add('sign-name', 'warn', '簽名', '已填頭銜但未填姓名。');
  }
  if (hasText(doc.contact.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.contact.email.trim())) {
    add('email', 'warn', '電子信箱', '電子信箱格式看起來不正確。');
  }

  // 主旨
  if (cfg.subject && hasText(doc.subject)) {
    const subject = doc.subject.trim();
    if (subject.length > SUBJECT_MAX) {
      add('subject-long', 'info', cfg.subjectLabel, `${cfg.subjectLabel}共 ${subject.length} 字，建議力求簡明（約 ${SUBJECT_MAX} 字內）。`);
    }
    if (!/[。]$/.test(subject)) add('subject-period', 'info', cfg.subjectLabel, `${cfg.subjectLabel}結尾建議加上句號。`);
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
  if (cfg.letterhead && mentionsAttachment && !hasAttachment) {
    add('att-missing', 'warn', '附件', '內文提到附件，但「附件」欄為空或填「無」。');
  }
  if (cfg.letterhead && hasAttachment && !mentionsAttachment) {
    add('att-unmentioned', 'info', '附件', '附件欄已填寫，但主旨或內文未提及附件。');
  }

  // 尚未填寫的「○」占位（範本產生）
  const placeholderWhere = [
    ...sections.filter((s) => s.text.includes('○')).map((s) => s.where),
    ...(doc.attachments.includes('○') ? ['附件'] : []),
    ...((cfg.meeting || cfg.senderOnly) && Object.values(doc.meeting).some((v) => v.includes('○')) ? ['開會資訊'] : []),
    ...(cfg.layout === 'budget' &&
    [doc.budget.year, doc.budget.period, doc.budget.editor, doc.budget.duties, doc.budget.divisions, doc.budget.purpose, doc.budget.tableTitle,
      ...doc.budget.items.flatMap((it) => [it.unit, it.name, it.code, it.amount, it.note])].some((v) => v.includes('○'))
      ? ['概算書']
      : []),
    ...(cfg.layout === 'minutes' &&
    [doc.minutes.opening, doc.minutes.speech, doc.minutes.agendaNote, doc.minutes.extempore,
      ...doc.minutes.cases.flatMap((c) => [c.proposer, c.subject, c.explanation, c.resolution])].some((v) => v.includes('○'))
      ? ['會議經過']
      : []),
    ...((cfg.motion || cfg.proposers || cfg.layout === 'review') &&
    [doc.motion.term, doc.motion.reviewer, ...doc.motion.proposalNames, ...doc.motion.rows.flatMap((r) => r.proposals ?? []), doc.motion.proposer, doc.motion.cosigners, doc.motion.draftTitle,
      ...doc.motion.rows.flatMap((r) => [r.amended, r.current, r.reason])].some((v) => v.includes('○'))
      ? [cfg.motion ? '議案關係文書' : cfg.layout === 'review' ? '審查報告對照表' : '提案議員']
      : []),
  ];
  for (const where of new Set(placeholderWhere)) {
    add(`placeholder:${where}`, 'warn', where, '尚有未填寫的「○」，請補上實際內容。');
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
