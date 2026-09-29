import { idb } from './idb';
import type { Agency, DraftRecord, TemplateRecord } from './types';
import { normalizeDocument } from '../storage';

export interface BackupFile {
  app: 'documenthelper';
  version: 1;
  exportedAt: string;
  contacts: Agency[];
  drafts: DraftRecord[];
  templates: TemplateRecord[];
}

export async function exportAll(now = new Date()): Promise<BackupFile> {
  const [contacts, drafts, templates] = await Promise.all([
    idb.getAll<Agency>('contacts'),
    idb.getAll<DraftRecord>('drafts'),
    idb.getAll<TemplateRecord>('templates'),
  ]);
  return { app: 'documenthelper', version: 1, exportedAt: now.toISOString(), contacts, drafts, templates };
}

/** 驗證並解析備份檔；格式不符時丟出可讀的錯誤訊息 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('檔案不是有效的 JSON');
  }
  const b = raw as Partial<BackupFile>;
  if (!b || b.app !== 'documenthelper' || !Array.isArray(b.contacts) || !Array.isArray(b.drafts) || !Array.isArray(b.templates)) {
    throw new Error('這不是公文小幫手的備份檔');
  }
  const hasId = (x: unknown) => typeof (x as { id?: unknown })?.id === 'string';
  if (![...b.contacts, ...b.drafts, ...b.templates].every(hasId)) throw new Error('備份檔內含格式不正確的資料');
  return {
    ...(b as BackupFile),
    drafts: b.drafts.map((d) => ({ ...d, doc: normalizeDocument(d.doc as never) })),
    templates: b.templates.map((t) => ({ ...t, doc: normalizeDocument(t.doc as never) })),
  };
}

/** 還原：以相同 id 覆蓋，其餘保留（不會刪除現有資料） */
export async function restore(backup: BackupFile): Promise<void> {
  await idb.putMany('contacts', backup.contacts);
  await idb.putMany('drafts', backup.drafts);
  await idb.putMany('templates', backup.templates);
}
