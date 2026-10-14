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

/** 表格：欄寬以內容寬度的比例表示，儲存格為純文字 */
export interface Table {
  columns: number[];
  header: string[];
  rows: string[][];
  /** pt */
  size: number;
}

export interface Block {
  runs: Run[];
  /** 有表格時 runs 為空，整個區塊是一張表 */
  table?: Table;
  align?: 'left' | 'center' | 'right';
  /** em：整段左縮 */
  indentEm?: number;
  /** em：首行凸排（正值＝第二行起比首行多縮排的量） */
  hangingEm?: number;
  /** pt */
  spaceBefore?: number;
  /** 從新的一頁開始 */
  pageBreakBefore?: boolean;
}

export const BODY_FONT = '標楷體';
export const SIGNATURE_FONTS: Record<OfficialDocument['signature']['font'], string> = {
  'yuji-boku': 'Yuji Boku',
  kai: BODY_FONT,
  default: 'Noto Sans TC',
};
export const SIGNATURE_COLOR = '1A4F8B';
export const BODY_SIZE = 16;
/** 議案關係文書（依學生議會樣張）：本文 14pt、標題 24pt、頁首與提案人 12pt、草案名稱 20pt */
const MOTION_SIZE = 14;
const MOTION_SMALL = 12;
const DRAFT_TABLES = {
  修正: { header: ['修　正　條　文', '現　行　條　文', '說　　　明'], columns: [1 / 3, 1 / 3, 1 / 3] },
  新訂: { header: ['條　　　文', '說　　　明'], columns: [0.6, 0.4] },
} as const;

/** 以 size pt 的字數換算成本文 em（版面縮排以 BODY_SIZE 為 1em） */
const chars = (n: number, size: number) => (n * size) / BODY_SIZE;

/** 全形字算 1em、半形算 0.5em，用於估算標號寬度 */
export function labelWidthEm(label: string): number {
  let w = 0;
  for (const ch of label) w += /[\u0000-ÿ]/.test(ch) ? 0.5 : 1;
  return w;
}

/** 每頁頁首文字；沒有頁首的文種回傳 null */
export function pageHeader(doc: OfficialDocument): string | null {
  return DOC_TYPES[doc.type].motion ? `學生議會第${doc.motion.term.trim() || '○'}屆` : null;
}

function splitNames(s: string): string[] {
  return s.split(/[\s、，,]+/).filter(Boolean);
}

/** 學生議會議案關係文書：案由、說明、提案人與連署人，草案對照表另起一頁 */
function buildMotionBlocks(doc: OfficialDocument): Block[] {
  const m = doc.motion;
  const blocks: Block[] = [];
  const text = (t: string, size = MOTION_SIZE, bold = false): Run => ({ text: t, size, bold });

  blocks.push({ runs: [text('學生議會關係文書', 24, true)], align: 'center' });
  blocks.push({
    runs: [text('案由：'), text(doc.subject || '（請填寫案由）')],
    indentEm: chars(3, MOTION_SIZE),
    hangingEm: chars(3, MOTION_SIZE),
    spaceBefore: 6,
  });

  const numbered = numberItems(doc.explanation).filter((it) => it.text.trim());
  if (numbered.length) {
    blocks.push({ runs: [text('說明：')], spaceBefore: 14 });
    for (const it of numbered) {
      const w = labelWidthEm(it.label);
      blocks.push({
        runs: [text(it.label + it.text)],
        indentEm: chars(1 + it.level * 2 + w, MOTION_SIZE),
        hangingEm: chars(w, MOTION_SIZE),
      });
    }
  }

  const cosigners = splitNames(m.cosigners);
  const proposer = `提案人：${m.proposer.trim()}`;
  if (cosigners.length) {
    const left = 11;
    blocks.push({ runs: [text(proposer, MOTION_SMALL)], indentEm: chars(left, MOTION_SMALL), spaceBefore: 48 });
    // 連署人每列四位，續列對齊第一位
    for (let i = 0; i < cosigners.length; i += 4) {
      const names = cosigners.slice(i, i + 4).join('　　');
      blocks.push({
        runs: [text(i === 0 ? `連署人：${names}` : names, MOTION_SMALL)],
        indentEm: chars(left + 4, MOTION_SMALL),
        hangingEm: i === 0 ? chars(4, MOTION_SMALL) : undefined,
      });
    }
  } else {
    blocks.push({ runs: [text(proposer, MOTION_SMALL)], align: 'right', spaceBefore: 48 });
  }

  const rows = m.rows.filter((r) => r.amended.trim() || r.current.trim() || r.reason.trim());
  if (rows.length || m.draftTitle.trim()) {
    const spec = DRAFT_TABLES[m.mode];
    blocks.push({ runs: [text(m.draftTitle.trim() || '（草案名稱）', 20)], align: 'center', pageBreakBefore: true });
    blocks.push({
      runs: [],
      spaceBefore: 6,
      table: {
        columns: [...spec.columns],
        header: [...spec.header],
        rows: rows.map((r) => (m.mode === '修正' ? [r.amended, r.current, r.reason] : [r.amended, r.reason])),
        size: MOTION_SIZE,
      },
    });
  }
  return blocks;
}

export function buildBlocks(doc: OfficialDocument): Block[] {
  const cfg = DOC_TYPES[doc.type];
  if (cfg.motion) return buildMotionBlocks(doc);
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
      runs: [{ text: `${cfg.subjectLabel}：`, bold: true }, { text: doc.subject || `（請填寫${cfg.subjectLabel}）` }],
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
