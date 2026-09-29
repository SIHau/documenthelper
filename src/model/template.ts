import type { OfficialDocument, OutlineItem } from './types';
import { newId } from './defaults';
import { todayIso } from './date';

const freshIds = (items: OutlineItem[]) => items.map((i) => ({ ...i, id: newId() }));

/** 由範本／舊稿建立新稿：日期改為今天、清掉發文字號、分項重新配發 id */
export function instantiate(saved: OfficialDocument, today = todayIso()): OfficialDocument {
  const d = structuredClone(saved);
  return {
    ...d,
    date: today,
    docNumber: '',
    explanation: freshIds(d.explanation),
    measures: freshIds(d.measures),
  };
}

export function draftTitle(doc: OfficialDocument): string {
  const t = (doc.subject || doc.meeting.reason || '').trim();
  return t || '（未命名）';
}

/** 是否為尚未填寫任何內容的空白稿 */
export function isBlank(doc: OfficialDocument): boolean {
  const texts = [
    doc.subject, doc.sender.name, doc.recipient.name, doc.docNumber, doc.attachments,
    doc.primaryRecipients, doc.ccRecipients, doc.signature.name,
    ...Object.values(doc.meeting),
    ...doc.explanation.map((i) => i.text),
    ...doc.measures.map((i) => i.text),
  ];
  return texts.every((t) => !t.trim());
}
