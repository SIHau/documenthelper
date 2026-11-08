/**
 * 法規純文字 → 條文。法規多半是從 Word 複製出來的 .txt：有零寬字元、縮排、每行固定字數折行，
 * 所以解析時先清掉這些，再依「第Ｘ章」「第Ｘ條（標題）」切開，折行的句子接回去。
 * 解析邏輯移植自 StudentGov（SIHau/studentgov）的 lib/lawText.ts，拿掉與其網站資料綁定的部分。
 */

export interface Article {
  /** 例：第一條、第三條之一 */
  no: string;
  /** 條文標題（括號內），選填 */
  title?: string;
  text: string;
  /** 所屬章節，例：第一章 總則 */
  chapter?: string;
}

const NUM = '[一二三四五六七八九十百千零〇0-9０-９]+';
const CHAPTER = new RegExp(`^第\\s*${NUM}\\s*[章編節]`);
const ARTICLE = new RegExp(`^第\\s*(${NUM})\\s*([條點])(?:\\s*之\\s*(${NUM}))?\\s*(.*)$`);
/** 「第五條規定」「第三條、第四條」這種開頭是折行後的引用，不是新的條文 */
const NOT_HEADING = /^(、|，|,|及|與|或|至|到|規定|之規定|所|第|者|各款|但書)/;
/** 這些結尾表示一段結束，下一行另起一段 */
const PARA_END = /[。：:；;！!？?」』）)]$/;
/** 款、目、項次開頭：一、 （一） (一) 1. 1、 */
const ITEM_START = /^([一二三四五六七八九十]+、|[（(][一二三四五六七八九十0-9]+[）)]|[0-9０-９]+[.、．])/;

const clean = (s: string) =>
  s
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');

/** 中文數字前後的空白拿掉：第 一   條 → 第一條 */
const squeeze = (s: string) => s.replace(/\s+/g, '');

/** 把一行接在一段文字後面：上一行沒有結束、這一行也不是新的款項，就直接接上 */
export function joinLine(text: string, line: string): string {
  if (!text) return line;
  if (PARA_END.test(text) || ITEM_START.test(line)) return `${text}\n${line}`;
  return text + line;
}

export interface ParsedLaw {
  /** 第一行看起來像法規名稱時的名稱；否則空字串 */
  name: string;
  articles: Article[];
}

/** 解析一部法規（或其中幾條）的純文字 */
export function parseLaw(text: string): ParsedLaw {
  const lines = clean(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let name = '';
  if (lines.length && !ARTICLE.test(squeeze(lines[0])) && !CHAPTER.test(squeeze(lines[0])) && !/沿革/.test(lines[0]) && lines[0].length <= 60) {
    name = lines.shift()!;
    // 名稱折成兩行：○○學校學生自治組織／章程審理規則
    const LAW_SUFFIX = /(法|條例|章程|辦法|規則|規程|細則|標準|準則|要點|須知)$/;
    if (!LAW_SUFFIX.test(name.replace(/\s+/g, '')) && lines.length && LAW_SUFFIX.test(lines[0].replace(/\s+/g, '')) && lines[0].length <= 30 && !ARTICLE.test(squeeze(lines[0]))) {
      name += lines.shift()!;
    }
  }
  name = name.replace(/\s+/g, '');

  const articles: Article[] = [];
  let chapter: string | undefined;
  let inHistory = false;

  for (const raw of lines) {
    const line = raw.replace(/\s{2,}/g, ' ');
    const flat = squeeze(line);
    if (!articles.length && /沿革/.test(flat) && flat.length <= 10) {
      inHistory = true; // 沿革到第一章、第一條之前都略過
      continue;
    }
    if (CHAPTER.test(flat)) {
      const m = new RegExp(`^(第${NUM}[章編節])(.*)$`).exec(flat)!;
      chapter = m[2] ? `${m[1]} ${m[2]}` : m[1];
      inHistory = false;
      continue;
    }
    const a = ARTICLE.exec(flat);
    if (a && !NOT_HEADING.test(a[4])) {
      let rest = line.replace(new RegExp(`^第\\s*${NUM}\\s*[條點](?:\\s*之\\s*${NUM})?\\s*`), '');
      let title: string | undefined;
      const t = /^[（(]([^）)]{1,30})[）)]\s*/.exec(rest);
      if (t) {
        title = t[1].trim();
        rest = rest.slice(t[0].length);
      }
      articles.push({ no: `第${a[1]}${a[2]}${a[3] ? `之${a[3]}` : ''}`, text: rest.trim(), ...(title ? { title } : {}), ...(chapter ? { chapter } : {}) });
      inHistory = false;
      continue;
    }
    if (articles.length) {
      const last = articles[articles.length - 1];
      last.text = joinLine(last.text, line);
    }
    // 第一條之前的沿革、前言不屬於條文，略過（inHistory 只是讓意圖更明確）
    else if (inHistory) continue;
  }
  return { name, articles };
}

/** 條文 → 對照表一列用的文字：「第一條（標題）　條文內容」，多段內容保留換行 */
export function articleText(a: Article): string {
  const head = `${a.no}${a.title ? `（${a.title}）` : ''}`;
  return a.text ? `${head}　${a.text}` : head;
}
