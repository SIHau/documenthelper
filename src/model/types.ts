/** 公文文種 */
export type DocType =
  | '函'
  | '書函'
  | '令'
  | '公告'
  | '開會通知單'
  | '催辦案件通知單'
  | '簽'
  | '議案關係文書'
  | '審查報告對照表'
  | '糾正案'
  | '會議紀錄'
  | '簽到表'
  | '概算書';

/** 開會通知單專用欄位 */
export interface Meeting {
  reason: string;
  time: string;
  place: string;
  chair: string;
  /** 聯絡人及電話 */
  contact: string;
  attendees: string;
  observers: string;
  /** 備註；每行一點，匯出時自動加上「一、」「二、」 */
  remarks: string;
  /** 會議紀錄：請假者、缺席者、記錄人員 */
  onLeave: string;
  absent: string;
  recorder: string;
  /** 議程頁標題，每行一列，例：第十五屆學生議會\n法制委員會第一次會議；議程另起一頁 */
  agenda: string;
}

/** 行文方向，影響期望語建議（M3） */
export type Direction = '上行' | '平行' | '下行';

export type Urgency = '' | '普通件' | '速件' | '最速件';
export type Secrecy = '' | '密' | '機密' | '極機密' | '絕對機密';

/** 分段項目：level 0 = 一、 1 = (一) 2 = 1、 3 = (1) ... */
export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export interface Party {
  name: string;
  /** 機關代碼（M5 通訊錄／交換 DI 使用） */
  code?: string;
}

/** 聯絡方式：承辦人、連絡電話、電子信箱、傳真 */
export interface ContactInfo {
  person: string;
  phone: string;
  email: string;
  fax: string;
}

/** 草案對照表的一列：修正（或新訂）條文、現行條文、說明 */
export interface AmendmentRow {
  id: string;
  /** 修正條文（新訂時為條文）；修正案中空白表示刪除該條 */
  amended: string;
  /** 現行條文；空白表示新增條文；新訂草案不使用 */
  current: string;
  reason: string;
  /** 審查報告對照表：各提案的條文，順序對應 Motion.proposalNames */
  proposals?: string[];
}

/** 修正：修正條文｜現行條文｜說明；新訂：條文｜說明 */
export type DraftMode = '修正' | '新訂';

/** 學生議會議案關係文書專用欄位 */
export interface Motion {
  /** 屆別，例：十四（頁首顯示「學生議會第十四屆」） */
  term: string;
  /** 提案人：議員姓名或黨團名稱 */
  proposer: string;
  /** 連署人，以空白或頓號分隔；黨團提案留空 */
  cosigners: string;
  /** 草案名稱，例：學生會組織章程修正草案 */
  draftTitle: string;
  mode: DraftMode;
  rows: AmendmentRow[];
  /** 審查報告對照表：審查會名稱（例：法制委員會），表頭為「法制委員會通過條文」 */
  reviewer: string;
  /** 審查報告對照表：併案審查的提案名稱（例：王小明等三人），每個提案一欄 */
  proposalNames: string[];
}

/** 概算表的一列 */
export interface BudgetItem {
  id: string;
  /** 處室；與上一列相同時表格只印第一列 */
  unit: string;
  name: string;
  /** 會計科目編號 */
  code: string;
  /** 金額（元），可含千分位逗號 */
  amount: string;
  note: string;
}

/** 概算書：封面、目次、甲、總說明（壹、前言），貳、概算案 */
export interface Budget {
  /** 學年度，例：114 */
  year: string;
  /** 起訖期間，例：114年8月1日至115年7月31日 */
  period: string;
  /** 編製單位，例：○○高中第十六屆學生議會 */
  editor: string;
  /** 前言：(一)現行法定掌職 (二)內部分層業務 (三)設立概算目的 */
  duties: string;
  divisions: string;
  purpose: string;
  /** 概算表標題，例：114學年度第一學期○○高中學生議會第十六屆預算案 */
  tableTitle: string;
  items: BudgetItem[];
}

/** 會議紀錄的一個討論案 */
export interface MinutesCase {
  id: string;
  proposer: string;
  subject: string;
  /** 說明，每行一點 */
  explanation: string;
  /** 決議，每行一點 */
  resolution: string;
}

/** 會議紀錄：壹、主席宣布開會 … 伍、臨時動議 */
export interface Minutes {
  /** 開會時刻，例：12:20 */
  opening: string;
  speech: string;
  agendaNote: string;
  cases: MinutesCase[];
  extempore: string;
}

/** 檔號與保存年限（函頭右上角） */
export interface Archive {
  fileNo: string;
  retention: string;
}

export type SignatureFont = 'yuji-boku' | 'kai' | 'default';

/** 文末簽名（頭銜、姓名） */
export interface Signature {
  enabled: boolean;
  title: string;
  name: string;
  font: SignatureFont;
}

export interface OfficialDocument {
  type: DocType;
  direction: Direction;
  /** 發文機關 */
  sender: Party;
  senderAddress: string;
  contact: ContactInfo;
  /** 受文者 */
  recipient: Party;
  /** 發文日期（西元 YYYY-MM-DD，顯示時轉民國） */
  date: string;
  /** 發文字號，例：府授字第1130001234號 */
  docNumber: string;
  urgency: Urgency;
  secrecy: Secrecy;
  /** 附件說明 */
  attachments: string;
  subject: string;
  explanation: OutlineItem[];
  /** 辦法（函）／擬辦（簽） */
  measures: OutlineItem[];
  /** 正本受文者 */
  primaryRecipients: string;
  /** 副本受文者 */
  ccRecipients: string;
  signature: Signature;
  archive: Archive;
  meeting: Meeting;
  motion: Motion;
  minutes: Minutes;
  budget: Budget;
}
