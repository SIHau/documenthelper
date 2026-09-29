import type { DocType } from './types';

/** 各文種的欄位與段落標題設定；表單、預覽、匯出、檢查皆以此為準 */
export interface DocTypeConfig {
  /** 受文者欄位（簽改為文末「敬陳」對象） */
  recipient: boolean;
  recipientLabel: string;
  /** 「敬陳」放在文末而非開頭 */
  recipientAtEnd: boolean;
  dateLabel: string;
  docNumber: boolean;
  urgencySecrecy: boolean;
  subject: boolean;
  /** 說明段標題；null 表示此文種沒有 */
  explanationLabel: string | null;
  measuresLabel: string | null;
  /** 開會通知單專用欄位 */
  meeting: boolean;
  /** 正本、副本 */
  routing: boolean;
  /** 主旨是否必須以期望語結尾（請查照等） */
  expectation: boolean;
}

const LETTER: DocTypeConfig = {
  recipient: true,
  recipientLabel: '受文者',
  recipientAtEnd: false,
  dateLabel: '發文日期',
  docNumber: true,
  urgencySecrecy: true,
  subject: true,
  explanationLabel: '說明',
  measuresLabel: '辦法',
  meeting: false,
  routing: true,
  expectation: true,
};

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  函: LETTER,
  書函: LETTER,
  公告: {
    ...LETTER,
    recipient: false,
    urgencySecrecy: false,
    explanationLabel: '依據',
    measuresLabel: '公告事項',
    routing: false,
    expectation: false,
  },
  開會通知單: {
    ...LETTER,
    subject: false,
    explanationLabel: null,
    measuresLabel: null,
    meeting: true,
    expectation: false,
  },
  簽: {
    ...LETTER,
    recipientLabel: '敬陳',
    recipientAtEnd: true,
    dateLabel: '日期',
    docNumber: false,
    urgencySecrecy: false,
    explanationLabel: '說明',
    measuresLabel: '擬辦',
    routing: false,
    expectation: false,
  },
};

export const DOC_TYPE_LIST = Object.keys(DOC_TYPES) as DocType[];
