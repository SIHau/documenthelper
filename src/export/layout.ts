import type { OfficialDocument } from '../model/types';
import { numberItems } from '../model/numbering';
import { toMinguoText } from '../model/date';
import { DOC_TYPES } from '../model/docTypes';

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
  const cfg = DOC_TYPES[doc.type];
  const blocks: Block[] = [];
  const line = (text: string, extra: Partial<Block> = {}, run: Partial<Run> = {}) =>
    blocks.push({ runs: [{ text, ...run }], ...extra });
  const row = (label: string, value: string, spaceBefore = 0) => {
    if (value) line(`${label}：${value}`, { spaceBefore });
  };

  line(`${doc.sender.name || '（發文機關）'}　${doc.type}`, { align: 'center' }, { bold: true, size: 22 });

  const contact: Array<[string, string]> = [
    ['地址', doc.senderAddress],
    ['承辦人', doc.contact.person],
    ['連絡電話', doc.contact.phone],
    ['電子信箱', doc.contact.email],
    ['傳真', doc.contact.fax],
  ];
  let first = true;
  for (const [k, v] of contact) {
    if (!v) continue;
    line(`${k}：${v}`, { align: 'right', spaceBefore: first ? 6 : 0 }, { size: 12 });
    first = false;
  }

  const head: Array<[string, string]> = [];
  if (cfg.recipient && !cfg.recipientAtEnd) head.push([cfg.recipientLabel, doc.recipient.name || '（受文者）']);
  head.push([cfg.dateLabel, toMinguoText(doc.date)]);
  if (cfg.docNumber) head.push(['發文字號', doc.docNumber]);
  if (cfg.urgencySecrecy) {
    head.push(['速別', doc.urgency]);
    head.push(['密等及解密條件或保密期限', doc.secrecy]);
  }
  head.push(['附件', doc.attachments]);
  let firstHead = true;
  for (const [k, v] of head) {
    if (!v) continue;
    row(k, v, firstHead ? 12 : 0);
    firstHead = false;
  }

  if (cfg.meeting) {
    const m = doc.meeting;
    const rows: Array<[string, string]> = [
      ['開會事由', m.reason],
      ['開會時間', m.time],
      ['開會地點', m.place],
      ['主持人', m.chair],
      ['聯絡人及電話', m.contact],
      ['出席者', m.attendees],
      ['列席者', m.observers],
      ['備註', m.remarks],
    ];
    let firstMeeting = true;
    for (const [k, v] of rows) {
      if (!v) continue;
      row(k, v, firstMeeting ? 12 : 0);
      firstMeeting = false;
    }
  }

  if (cfg.subject) {
    blocks.push({
      runs: [{ text: '主旨：', bold: true }, { text: doc.subject || '（請填寫主旨）' }],
      spaceBefore: 12,
    });
  }

  const outline = (title: string | null, items: OfficialDocument['explanation']) => {
    if (!title) return;
    const numbered = numberItems(items).filter((it) => it.text.trim());
    if (!numbered.length) return;
    line(title + '：', { spaceBefore: 12 }, { bold: true });
    for (const it of numbered) {
      const w = labelWidthEm(it.label);
      blocks.push({ runs: [{ text: it.label + it.text }], indentEm: it.level * 2 + w, hangingEm: w });
    }
  };
  outline(cfg.explanationLabel, doc.explanation);
  outline(cfg.measuresLabel, doc.measures);

  if (cfg.recipient && cfg.recipientAtEnd && doc.recipient.name) {
    line(`${cfg.recipientLabel}　${doc.recipient.name}`, { spaceBefore: 12 });
  }

  if (cfg.routing) {
    const routes: Array<[string, string]> = [
      ['正本', doc.primaryRecipients],
      ['副本', doc.ccRecipients],
    ];
    let firstRoute = true;
    for (const [k, v] of routes) {
      if (!v) continue;
      row(k, v, firstRoute ? 24 : 0);
      firstRoute = false;
    }
  }

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

const INVALID_NAME_CHARS = /[\\/:*?"<>|\s]/g;

/**
 * 檔名：優先使用發文字號（例：裙萌議侯字第20261140416001號.pdf）。
 * 尚未填寫發文字號時，改用「文種_日期_主旨前 15 字」，避免多份稿件檔名相同。
 */
export function exportFileName(doc: OfficialDocument, ext: string): string {
  const number = doc.docNumber.replace(INVALID_NAME_CHARS, '');
  if (number) return `${number}.${ext}`;
  const subject = doc.subject.replace(INVALID_NAME_CHARS, '').slice(0, 15);
  return `${[doc.type, doc.date, subject].filter(Boolean).join('_')}.${ext}`;
}
