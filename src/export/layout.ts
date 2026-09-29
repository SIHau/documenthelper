import type { OfficialDocument } from '../model/types';
import { numberItems } from '../model/numbering';
import { toMinguoText } from '../model/date';

/** 匯出用的中介版面：ODT、DOCX 等格式共用，確保各格式內容一致 */
export interface Run {
  text: string;
  bold?: boolean;
  /** pt */
  size?: number;
  color?: string;
  font?: string;
}

export interface Block {
  runs: Run[];
  align?: 'left' | 'center' | 'right';
  /** em：整段左縮 */
  indentEm?: number;
  /** em：首行凸排（正值＝第二行起比首行多縮排的量） */
  hangingEm?: number;
  /** pt */
  spaceBefore?: number;
}

export const BODY_FONT = '標楷體';
export const SIGNATURE_FONTS: Record<OfficialDocument['signature']['font'], string> = {
  'yuji-boku': 'Yuji Boku',
  kai: BODY_FONT,
  default: 'Noto Sans TC',
};
export const SIGNATURE_COLOR = '1A4F8B';
export const BODY_SIZE = 16;

/** 全形字算 1em、半形算 0.5em，用於估算標號寬度 */
export function labelWidthEm(label: string): number {
  let w = 0;
  for (const ch of label) w += /[\u0000-ÿ]/.test(ch) ? 0.5 : 1;
  return w;
}

export function buildBlocks(doc: OfficialDocument): Block[] {
  const blocks: Block[] = [];
  const line = (text: string, extra: Partial<Block> = {}, run: Partial<Run> = {}) =>
    blocks.push({ runs: [{ text, ...run }], ...extra });

  line(`${doc.sender.name || '（發文機關）'}　${doc.type}`, { align: 'center' }, { bold: true, size: 22 });

  const contact: Array<[string, string]> = [
    ['地址', doc.senderAddress],
    ['承辦人', doc.contact.person],
    ['連絡電話', doc.contact.phone],
    ['電子信箱', doc.contact.email],
    ['傳真', doc.contact.fax],
  ];
  contact.forEach(([k, v], i) => {
    if (v) line(`${k}：${v}`, { align: 'right', spaceBefore: i === 0 ? 6 : 0 }, { size: 12 });
  });

  const rows: Array<[string, string]> = [
    ['受文者', doc.recipient.name || '（受文者）'],
    ['發文日期', toMinguoText(doc.date)],
    ['發文字號', doc.docNumber],
    ['速別', doc.urgency],
    ['密等及解密條件或保密期限', doc.secrecy],
    ['附件', doc.attachments],
  ];
  rows.forEach(([k, v], i) => {
    if (v) line(`${k}：${v}`, { spaceBefore: i === 0 ? 12 : 0 });
  });

  blocks.push({
    runs: [{ text: '主旨：', bold: true }, { text: doc.subject || '（請填寫主旨）' }],
    spaceBefore: 12,
  });

  const outline = (title: string, items: OfficialDocument['explanation']) => {
    const numbered = numberItems(items).filter((it) => it.text.trim());
    if (!numbered.length) return;
    line(title, { spaceBefore: 12 }, { bold: true });
    for (const it of numbered) {
      const w = labelWidthEm(it.label);
      blocks.push({ runs: [{ text: it.label + it.text }], indentEm: it.level * 2 + w, hangingEm: w });
    }
  };
  outline('說明：', doc.explanation);
  outline('辦法：', doc.measures);

  if (doc.primaryRecipients) line(`正本：${doc.primaryRecipients}`, { spaceBefore: 24 });
  if (doc.ccRecipients) line(`副本：${doc.ccRecipients}`);

  const { signature: s } = doc;
  if (s.enabled && (s.title || s.name)) {
    const font = SIGNATURE_FONTS[s.font];
    blocks.push({
      runs: [
        { text: s.title, size: 22, color: SIGNATURE_COLOR, font },
        { text: s.title && s.name ? '　' : '', size: 22, font },
        { text: s.name, size: 44, color: SIGNATURE_COLOR, font },
      ],
      indentEm: 1,
      spaceBefore: 48,
    });
  }
  return blocks;
}

/** 檔名：文種_日期_主旨前 15 字，移除檔名不允許的字元 */
export function exportFileName(doc: OfficialDocument, ext: string): string {
  const subject = doc.subject.replace(/[\\/:*?"<>|\s]/g, '').slice(0, 15);
  const parts = [doc.type, doc.date, subject].filter(Boolean);
  return `${parts.join('_')}.${ext}`;
}
