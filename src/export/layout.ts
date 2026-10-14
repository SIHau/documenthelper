import type { OfficialDocument } from '../model/types';
import { formatLabel, numberItems } from '../model/numbering';
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

/** 函頭各列字級（依學生議會樣張）：標題 20pt、檔號 10pt、聯絡資訊與發文日期等 12pt */
const TITLE_SIZE = 20;
const ARCHIVE_SIZE = 10;
const SMALL_SIZE = 12;

/** 函頭類文件每頁頁尾印「第 X 頁 共 Y 頁」 */
export function hasPageNumbers(doc: OfficialDocument): boolean {
  return DOC_TYPES[doc.type].letterhead;
}

/** 第一頁左側的裝訂線 */
export function hasBindingLine(doc: OfficialDocument): boolean {
  return DOC_TYPES[doc.type].filing;
}

/** 左右邊界（cm）：函頭類依樣張 2.5 cm，其餘 2 cm */
export function marginXcm(doc: OfficialDocument): number {
  return DOC_TYPES[doc.type].letterhead ? 2.5 : 2;
}

/** 頁尾文字的組成：第 {page} 頁 共 {total} 頁 */
export const PAGE_NUMBER_PARTS = ['第 ', ' 頁 共 ', ' 頁'] as const;

/** 分項內容：一、(一)… 凸排；label 為 null 時不加段落標題 */
function outlineBlocks(label: string | null, items: OfficialDocument['explanation'], spaceBefore = 12, base = 0): Block[] {
  const numbered = numberItems(items).filter((it) => it.text.trim());
  if (!numbered.length) return [];
  const out: Block[] = [];
  if (label) out.push({ runs: [{ text: label + '：' }], spaceBefore });
  numbered.forEach((it, i) => {
    const w = labelWidthEm(it.label);
    out.push({
      runs: [{ text: it.label + it.text }],
      indentEm: base + it.level * 2 + w,
      hangingEm: w,
      spaceBefore: !label && i === 0 ? spaceBefore : undefined,
    });
  });
  return out;
}

/** 開會通知單第二頁：議程標題、開會時間地點、報告事項、討論事項 */
function agendaBlocks(doc: OfficialDocument): Block[] {
  const titles = doc.meeting.agenda.split('\n').map((t) => t.trim()).filter(Boolean);
  const sections = ([
    ['報告事項', doc.explanation],
    ['討論事項', doc.measures],
  ] as const).filter(([, items]) => items.some((it) => it.text.trim()));
  if (!titles.length && !sections.length) return [];
  const blocks: Block[] = (titles.length ? titles : ['議程']).map((t, i) => ({
    runs: [{ text: t, bold: true, size: 18 }],
    align: 'center',
    pageBreakBefore: i === 0,
  }));
  const rows: Array<[string, string]> = [
    ['開會時間', doc.meeting.time],
    ['開會地點', doc.meeting.place],
  ];
  rows.filter(([, v]) => v).forEach(([k, v], i) => {
    blocks.push({ runs: [{ text: `${k}：${v}`, size: 14 }], indentEm: 4, spaceBefore: i === 0 ? 8 : 0 });
  });
  for (const [label, items] of sections) {
    blocks.push({ runs: [{ text: label, bold: true }], indentEm: 2, spaceBefore: 18 });
    blocks.push(...outlineBlocks(null, items, 6));
  }
  return blocks;
}

export function buildBlocks(doc: OfficialDocument): Block[] {
  const cfg = DOC_TYPES[doc.type];
  if (cfg.motion) return buildMotionBlocks(doc);
  const blocks: Block[] = [];
  const line = (text: string, extra: Partial<Block> = {}, run: Partial<Run> = {}) =>
    blocks.push({ runs: [{ text, ...run }], ...extra });
  const row = (label: string, value: string, spaceBefore = 0, size?: number) => {
    if (value) line(`${label}：${value}`, { spaceBefore }, { size });
  };
  const rows = (list: Array<[string, string]>, spaceBefore: number, size?: number) => {
    let first = true;
    for (const [k, v] of list) {
      if (!v) continue;
      row(k, v, first ? spaceBefore : 0, size);
      first = false;
    }
  };

  // 右上角檔號、保存年限（10pt，左緣對齊）
  if (cfg.filing) {
    line(`檔　　號：${doc.archive.fileNo}`, { indentEm: 20 }, { size: ARCHIVE_SIZE });
    line(`保存年限：${doc.archive.retention}`, { indentEm: 20 }, { size: ARCHIVE_SIZE });
  }

  line(`${doc.sender.name || '（發文機關）'}　${doc.type}`, { align: 'center', spaceBefore: cfg.filing ? 4 : 0 }, { size: TITLE_SIZE });

  const contact: Array<[string, string]> = [
    ['地址', doc.senderAddress],
    ['承辦人', doc.contact.person],
    ['連絡電話', doc.contact.phone],
    ['電子郵件', doc.contact.email],
    ['傳真', doc.contact.fax],
  ];
  let first = true;
  for (const [k, v] of contact) {
    if (!v) continue;
    line(`${k}：${v}`, { align: 'right', spaceBefore: first ? 2 : 0 }, { size: SMALL_SIZE });
    first = false;
  }

  const recipient = doc.recipient.name || (cfg.recipientRequired ? '（受文者）' : '');
  const showRecipient = cfg.recipient && !cfg.recipientAtEnd && recipient;
  if (showRecipient && !cfg.recipientAfterHead) row(cfg.recipientLabel, recipient, 18);

  const head: Array<[string, string]> = [[cfg.dateLabel, toMinguoText(doc.date)]];
  if (cfg.docNumber) head.push(['發文字號', doc.docNumber]);
  if (cfg.urgencySecrecy) {
    head.push(['速別', doc.urgency]);
    head.push(['密等及解密條件或保密期限', doc.secrecy]);
  }
  head.push(['附件', doc.attachments]);
  rows(head, 12, SMALL_SIZE);

  if (showRecipient && cfg.recipientAfterHead) row(cfg.recipientLabel, recipient, 24);

  if (cfg.meeting) {
    const m = doc.meeting;
    rows(
      [
        ['開會事由', m.reason],
        ['開會時間', m.time],
        ['開會地點', m.place],
        ['主持人', m.chair],
        ['聯絡人及電話', m.contact],
      ],
      18,
    );
    rows(
      [
        ['出席者', m.attendees],
        ['列席者', m.observers],
      ],
      12,
      SMALL_SIZE,
    );
    const remarks = m.remarks.split('\n').map((r) => r.trim()).filter(Boolean);
    if (remarks.length) {
      line('備註：', { spaceBefore: 12 });
      remarks.forEach((r, i) => {
        const label = formatLabel(0, i + 1);
        const w = labelWidthEm(label);
        line(label + r, { indentEm: 2 + w, hangingEm: w });
      });
    }
  }

  const hasSubject = cfg.subject && (cfg.subjectRequired || doc.subject.trim());
  if (hasSubject) {
    blocks.push({
      runs: [{ text: `${cfg.subjectLabel}：` }, { text: doc.subject || `（請填寫${cfg.subjectLabel}）` }],
      indentEm: 3,
      hangingEm: 3,
      spaceBefore: 18,
    });
  }

  if (!cfg.meeting) {
    // 令沒有主旨時，本文直接書寫，不加「說明」
    const bare = cfg.subject && !hasSubject;
    const body = doc.explanation.filter((it) => it.text.trim());
    if (bare && body.length === 1) {
      line(body[0].text, { spaceBefore: 18 });
    } else {
      blocks.push(...outlineBlocks(bare ? null : cfg.explanationLabel, doc.explanation, bare ? 18 : 0, 1));
    }
    blocks.push(...outlineBlocks(cfg.measuresLabel, doc.measures, 0, 1));
  }

  if (cfg.recipient && cfg.recipientAtEnd && doc.recipient.name) {
    line(`${cfg.recipientLabel}　${doc.recipient.name}`, { spaceBefore: 12 });
  }

  if (cfg.routing) {
    rows(
      [
        ['正本', doc.primaryRecipients],
        ['副本', doc.ccRecipients],
      ],
      24,
      SMALL_SIZE,
    );
  }

  const { signature: s } = doc;
  if (s.enabled && (s.title || s.name)) {
    const font = SIGNATURE_FONTS[s.font];
    blocks.push({
      runs: [
        { text: s.title, size: s.name ? 22 : 26, color: SIGNATURE_COLOR, font },
        { text: s.title && s.name ? '　' : '', size: 22, font },
        { text: s.name, size: 44, color: SIGNATURE_COLOR, font },
      ],
      indentEm: 1,
      spaceBefore: 48,
    });
  }

  if (cfg.meeting) blocks.push(...agendaBlocks(doc));
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
