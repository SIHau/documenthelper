import type { DocType } from './types';

/** 各文種的欄位與段落標題設定；表單、預覽、匯出、檢查皆以此為準 */
export interface DocTypeConfig {
  /** 受文者欄位（簽改為文末「敬陳」對象） */
  recipient: boolean;
  recipientLabel: string;
  /** 「敬陳」放在文末而非開頭 */
  recipientAtEnd: boolean;
  /** 受文者列在發文日期與字號之後（令） */
  recipientAfterHead: boolean;
  /** 受文者是否必填 */
  recipientRequired: boolean;
  dateLabel: string;
  docNumber: boolean;
  urgencySecrecy: boolean;
  subject: boolean;
  /** 主旨欄的標題（議案稱「案由」） */
  subjectLabel: string;
  /** 主旨是否必填；令可只寫本文（例：茲任命…） */
  subjectRequired: boolean;
  /** 說明段標題；null 表示此文種沒有 */
  explanationLabel: string | null;
  measuresLabel: string | null;
  /** 開會通知單專用欄位 */
  meeting: boolean;
  /** 正本、副本 */
  routing: boolean;
  /** 主旨是否必須以期望語結尾（請查照等） */
  expectation: boolean;
  /** 函頭：發文機關、聯絡資訊、發文日期與字號、附件、副本、簽名 */
  letterhead: boolean;
  /** 右上角檔號、保存年限與左側裝訂線 */
  filing: boolean;
  /** 議案關係文書：提案人、連署人與草案對照表 */
  motion: boolean;
  /** 版面：一般公文（函頭類、議案關係文書）或學生議會的表格類文書 */
  layout: 'standard' | 'review' | 'correction' | 'minutes' | 'signin';
  /** 表單顯示提案人、連署人 */
  proposers: boolean;
  /** 沒有函頭，但標題要用機關名稱（會議紀錄、簽到表） */
  senderOnly: boolean;
}

const LETTER: DocTypeConfig = {
  recipient: true,
  recipientLabel: '受文者',
  recipientAtEnd: false,
  recipientAfterHead: false,
  recipientRequired: true,
  dateLabel: '發文日期',
  docNumber: true,
  urgencySecrecy: true,
  subject: true,
  subjectLabel: '主旨',
  subjectRequired: true,
  explanationLabel: '說明',
  measuresLabel: '辦法',
  meeting: false,
  routing: true,
  expectation: true,
  letterhead: true,
  filing: true,
  motion: false,
  layout: 'standard',
  proposers: false,
  senderOnly: false,
};

/** 學生議會表格類文書的共同設定：沒有函頭、受文者、主旨與分項內容 */
const COUNCIL_FORM: DocTypeConfig = {
  ...LETTER,
  recipient: false,
  docNumber: false,
  urgencySecrecy: false,
  subject: false,
  explanationLabel: null,
  measuresLabel: null,
  routing: false,
  expectation: false,
  letterhead: false,
  filing: false,
};

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  函: LETTER,
  書函: LETTER,
  // 議長令：發文日期與字號在受文者之前；可不寫主旨，只寫本文
  令: {
    ...LETTER,
    recipientAfterHead: true,
    recipientRequired: false,
    urgencySecrecy: false,
    subjectRequired: false,
    measuresLabel: null,
    routing: false,
    expectation: false,
  },
  // 依學生議會樣張：主旨、依據、說明；沒有檔號與裝訂線
  公告: {
    ...LETTER,
    recipient: false,
    urgencySecrecy: false,
    explanationLabel: '依據',
    measuresLabel: '說明',
    routing: false,
    expectation: false,
    filing: false,
  },
  // 報告事項與討論事項印在第二頁的議程
  開會通知單: {
    ...LETTER,
    subject: false,
    explanationLabel: '報告事項',
    measuresLabel: '討論事項',
    meeting: true,
    expectation: false,
  },
  催辦案件通知單: {
    ...LETTER,
    explanationLabel: null,
    measuresLabel: null,
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
    filing: false,
  },
  議案關係文書: {
    ...LETTER,
    recipient: false,
    docNumber: false,
    urgencySecrecy: false,
    subjectLabel: '案由',
    measuresLabel: null,
    routing: false,
    expectation: false,
    letterhead: false,
    filing: false,
    motion: true,
    proposers: true,
  },
  // 審查會通過條文｜各提案｜現行條文｜說明
  審查報告對照表: { ...COUNCIL_FORM, layout: 'review' },
  糾正案: {
    ...COUNCIL_FORM,
    layout: 'correction',
    recipient: true,
    recipientLabel: '被糾正機關',
    subject: true,
    subjectLabel: '案由',
    explanationLabel: '事實與理由',
    proposers: true,
  },
  會議紀錄: { ...COUNCIL_FORM, layout: 'minutes', senderOnly: true },
  簽到表: { ...COUNCIL_FORM, layout: 'signin', senderOnly: true },
};

export const DOC_TYPE_LIST = Object.keys(DOC_TYPES) as DocType[];
