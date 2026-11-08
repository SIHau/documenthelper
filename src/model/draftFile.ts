import type { OfficialDocument } from './types';
import { DOC_TYPE_LIST } from './docTypes';
import { normalizeDocument } from '../storage';
import { newId } from './defaults';

/**
 * 單一稿件的檔案格式：就是 OfficialDocument 的 JSON（與 StudentGov「公文原稿.json」相同），
 * 收件人用公文小幫手開啟就能接手編輯或回覆。
 */
export const DRAFT_FILE_MIME = 'application/json';

export function serializeDraft(doc: OfficialDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** 解析稿件檔；格式不符時丟出可讀的錯誤訊息。缺少的欄位會補預設值（相容舊版稿件）。 */
export function parseDraftFile(text: string): OfficialDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('檔案不是有效的 JSON');
  }
  const d = raw as Partial<OfficialDocument> | null;
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('這不是公文稿件檔');
  // 備份檔（含 drafts 陣列）不是單一稿件，給明確的指引
  if (Array.isArray((d as { drafts?: unknown }).drafts)) throw new Error('這是整批備份檔，請改用「備份與還原」');
  if (typeof d.type !== 'string' || !(DOC_TYPE_LIST as string[]).includes(d.type)) {
    throw new Error('這不是公文稿件檔（找不到文種）');
  }
  if (!Array.isArray(d.explanation) && d.explanation !== undefined) throw new Error('稿件檔的內容格式不正確');
  const doc = normalizeDocument(d as Record<string, unknown>);
  // 分項與表格列靠 id 區分；來源檔缺少或重複時重新配發，避免畫面上的列互相覆蓋
  return {
    ...doc,
    explanation: uniqueIds(doc.explanation),
    measures: uniqueIds(doc.measures),
    motion: { ...doc.motion, rows: uniqueIds(doc.motion.rows) },
    minutes: { ...doc.minutes, cases: uniqueIds(doc.minutes.cases) },
    budget: { ...doc.budget, items: uniqueIds(doc.budget.items) },
  };
}

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.map((it) => {
    const id = typeof it?.id === 'string' && it.id && !seen.has(it.id) ? it.id : newId();
    seen.add(id);
    return { ...it, id };
  });
}
