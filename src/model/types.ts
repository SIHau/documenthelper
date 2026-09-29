/** 公文文種（M1 先支援函與書函，其餘文種於 M3 加入） */
export type DocType = '函' | '書函';

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

export interface OfficialDocument {
  type: DocType;
  direction: Direction;
  /** 發文機關 */
  sender: Party;
  senderAddress: string;
  contact: string;
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
}
