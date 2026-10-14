/** 公文文種 */
export type DocType = '函' | '書函' | '公告' | '開會通知單' | '簽' | '議案關係文書';

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
  remarks: string;
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
  meeting: Meeting;
  motion: Motion;
}
