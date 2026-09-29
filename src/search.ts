import type { DraftRecord } from './db/types';
import type { Agency } from './db/types';

/** 全部關鍵字（以空白分隔）都要出現才算符合，不分大小寫 */
function matchAll(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t));
}

export function matchDraft(rec: DraftRecord, query: string): boolean {
  const d = rec.doc;
  const text = [
    rec.title, d.type, d.date, d.docNumber, d.subject, d.sender.name, d.recipient.name,
    d.meeting.reason, d.primaryRecipients, d.ccRecipients,
    ...d.explanation.map((i) => i.text),
    ...d.measures.map((i) => i.text),
  ].join('\n');
  return matchAll(text, query);
}

export function matchAgency(a: Agency, query: string): boolean {
  return matchAll([a.name, a.code, a.address, a.phone, a.email, a.note].join('\n'), query);
}
