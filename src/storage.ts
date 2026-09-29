import type { OfficialDocument } from './model/types';
import { emptyDocument } from './model/defaults';

const KEY = 'documenthelper:draft:v1';

/** 合併預設值；舊版草稿的 contact 為單一字串，轉為承辦人欄位 */
function migrate(saved: Record<string, unknown>): OfficialDocument {
  const base = emptyDocument();
  const contact =
    typeof saved.contact === 'string'
      ? { ...base.contact, person: saved.contact }
      : { ...base.contact, ...(saved.contact as object) };
  const signature = { ...base.signature, ...(saved.signature as object) };
  return { ...base, ...saved, contact, signature } as OfficialDocument;
}

export function loadDraft(): OfficialDocument {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* 資料損毀或無法存取時使用空白稿 */
  }
  return emptyDocument();
}

export function saveDraft(doc: OfficialDocument): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    /* 儲存空間不足時略過，不中斷編輯 */
  }
}
