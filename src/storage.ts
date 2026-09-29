import type { OfficialDocument } from './model/types';
import { emptyDocument } from './model/defaults';

const KEY = 'documenthelper:draft:v1';

export function loadDraft(): OfficialDocument {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyDocument(), ...JSON.parse(raw) };
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
