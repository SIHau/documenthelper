import type { OfficialDocument } from '../model/types';

/** 通訊錄：機關／單位 */
export interface Agency {
  id: string;
  name: string;
  /** 機關代碼（由使用者自行維護） */
  code: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  note: string;
}

/** 歷史稿件 */
export interface DraftRecord {
  id: string;
  title: string;
  doc: OfficialDocument;
  updatedAt: number;
}

/** 使用者範本 */
export interface TemplateRecord {
  id: string;
  name: string;
  doc: OfficialDocument;
  createdAt: number;
}

export type StoreName = 'contacts' | 'drafts' | 'templates';
export const STORE_NAMES: StoreName[] = ['contacts', 'drafts', 'templates'];
