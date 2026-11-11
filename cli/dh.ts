/**
 * 公文小幫手命令列：讓 AI（或任何腳本）不開網頁也能起稿、檢查、預覽與匯出公文。
 * 直接使用 src/ 裡與網頁、桌面版相同的程式，結果與畫面上完全一致。
 * 用法見 `dh help`，完整說明見 .claude/skills/documenthelper/SKILL.md。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DOC_TYPES, DOC_TYPE_LIST } from '../src/model/docTypes';
import { emptyDocument } from '../src/model/defaults';
import { parseDraftFile, serializeDraft } from '../src/model/draftFile';
import { checkDocument } from '../src/rules';
import { buildBlocks, exportFileName } from '../src/export/layout';
import type { Block } from '../src/export/layout';
import { buildOdt } from '../src/export/odt';
import { buildDocx } from '../src/export/docx';
import { buildPdf } from '../src/export/pdf';
import { nodePdfFonts } from './fonts';
import { BUILTIN_TEMPLATES } from '../src/data/builtinTemplates';
import { EXPECTATIONS, PHRASE_GROUPS } from '../src/data/phrases';
import { processDeadline, URGENCY_DAYS } from '../src/model/deadline';
import { COUNCIL_WORDS, defaultWord, nextDocNumber } from '../src/model/docNumber';
import { parseLaw } from '../src/model/lawText';
import { toMinguoText, todayIso } from '../src/model/date';
import { instantiate } from '../src/model/template';
import type { Direction, DocType, Urgency } from '../src/model/types';

const HELP = `公文小幫手命令列（dh）

起稿
  types                          列出文種，以及各文種使用的欄位（JSON）
  new <文種> [選項]              產生空白稿件（JSON，輸出到標準輸出）
      --sender 機關  --recipient 受文者  --date YYYY-MM-DD  --direction 上行|平行|下行|斜行
  templates                      列出內建範本
  templates show <id> [--date YYYY-MM-DD]   由內建範本產生稿件（JSON）
  phrases [上行|平行|下行|斜行]       用語庫：期望語與常用句型

檢查與預覽
  check <稿件.json> [--json]     格式與用語檢查；有「錯誤」時結束代碼為 1
  preview <稿件.json>            純文字版面預覽（含自動編號與民國日期）
  normalize <稿件.json>          補齊欄位、配發分項 id 後輸出完整稿件（JSON）

匯出
  render <稿件.json> [--format pdf|odt|docx|all] [--out 資料夾]   預設 pdf，資料夾預設為目前目錄
  filename <稿件.json> <副檔名>  顯示匯出時使用的檔名

輔助計算
  deadline --date YYYY-MM-DD [--urgency 最速件|速件|普通件] [--limit YYYY-MM-DD]   辦理期限
  docnumber --word 字別 --date YYYY-MM-DD [--used 字號1,字號2]   產生下一個發文字號
  law <法規.txt>                 把法規純文字解析成條文（JSON）

稿件檔可以用 - 代表從標準輸入讀取。稿件只需寫用到的欄位，其餘會自動補預設值。`;

class UsageError extends Error {}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags.set(key, true);
      else {
        flags.set(key, next);
        i++;
      }
    } else positional.push(a);
  }
  const str = (k: string): string | undefined => {
    const v = flags.get(k);
    return typeof v === 'string' ? v : undefined;
  };
  return { positional, flags, str, has: (k: string) => flags.has(k) };
}

function readInput(path: string | undefined): string {
  if (!path) throw new UsageError('缺少稿件檔路徑');
  try {
    return readFileSync(path === '-' ? 0 : resolve(path), 'utf8');
  } catch (e) {
    throw new UsageError(`讀不到檔案 ${path}：${e instanceof Error ? e.message : e}`);
  }
}

const loadDraft = (path: string | undefined) => parseDraftFile(readInput(path));
const out = (s: string) => process.stdout.write(s.endsWith('\n') ? s : `${s}\n`);
const json = (v: unknown) => out(JSON.stringify(v, null, 2));

function requireDocType(name: string | undefined): DocType {
  if (!name || !(DOC_TYPE_LIST as string[]).includes(name)) {
    throw new UsageError(`文種必須是：${DOC_TYPE_LIST.join('、')}`);
  }
  return name as DocType;
}

function requireDate(v: string | undefined, label = '--date'): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UsageError(`${label} 必須是 YYYY-MM-DD`);
  return v;
}

/** 文種設定 → 給人（與 AI）看的欄位說明 */
function describeType(type: DocType) {
  const c = DOC_TYPES[type];
  return {
    文種: type,
    版面: c.layout,
    受文者: c.recipient ? { 欄位名稱: c.recipientLabel, 必填: c.recipientRequired, 位置: c.recipientAtEnd ? '文末（敬陳）' : c.recipientAfterHead ? '發文日期與字號之後' : '開頭' } : null,
    主旨: c.subject ? { 欄位名稱: c.subjectLabel, 必填: c.subjectRequired, 需期望語結尾: c.expectation } : null,
    說明段: c.explanationLabel,
    辦法段: c.measuresLabel,
    發文字號: c.docNumber,
    速別與密等: c.urgencySecrecy,
    開會欄位: c.meeting,
    正本副本: c.routing,
    函頭: c.letterhead,
    議案欄位: c.motion,
    提案人連署人: c.proposers,
  };
}

/** 版面區塊 → 純文字（預覽用）；沒有字體資訊，只呈現內容、對齊與縮排 */
function blockToText(b: Block): string {
  if (b.table) {
    const t = b.table;
    const rows = [...(t.header.length ? [t.header] : []), ...t.rows];
    return rows.map((r) => `| ${r.map((c) => c.replace(/\n/g, ' / ')).join(' | ')} |`).join('\n');
  }
  const text = b.runs.map((r) => r.text).join('');
  const pad = '　'.repeat(Math.max(0, Math.round((b.indentEm ?? 0) - (b.hangingEm ?? 0))));
  const lead = b.pageBreakBefore ? '──────── 換頁 ────────\n' : '';
  if (b.align === 'center') return `${lead}【置中】${text}`;
  if (b.align === 'right') return `${lead}【靠右】${text}`;
  return `${lead}${pad}${text}`;
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(HELP);
      return 0;

    case 'types': {
      json(DOC_TYPE_LIST.map(describeType));
      return 0;
    }

    case 'new': {
      const type = requireDocType(a.positional[0]);
      const doc = emptyDocument(type);
      if (a.str('sender')) doc.sender = { name: a.str('sender')! };
      if (a.str('recipient')) doc.recipient = { name: a.str('recipient')! };
      if (a.str('date')) doc.date = requireDate(a.str('date'));
      const dir = a.str('direction');
      if (dir) {
        if (!['上行', '平行', '下行', '斜行'].includes(dir)) throw new UsageError('--direction 必須是 上行、平行、下行 或 斜行');
        doc.direction = dir as Direction;
      }
      out(serializeDraft(doc));
      return 0;
    }

    case 'templates': {
      if (a.positional[0] === 'show') {
        const id = a.positional[1];
        const t = BUILTIN_TEMPLATES.find((x) => x.id === id || x.id === `builtin:${id}`);
        if (!t) throw new UsageError(`找不到範本 ${id}；用 templates 查看清單`);
        out(serializeDraft(instantiate(t.build(), a.str('date') ? requireDate(a.str('date')) : todayIso())));
        return 0;
      }
      json(BUILTIN_TEMPLATES.map((t) => ({ id: t.id, 名稱: t.name, 說明: t.description, 文種: t.build().type })));
      return 0;
    }

    case 'phrases': {
      const dir = a.positional[0] as Direction | undefined;
      if (dir && !(dir in EXPECTATIONS)) throw new UsageError('方向必須是 上行、平行、下行 或 斜行');
      json({
        期望語: dir ? { [dir]: EXPECTATIONS[dir] } : EXPECTATIONS,
        常用句型: PHRASE_GROUPS.map((g) => ({ 類別: g.title, 用語: g.phrases })),
      });
      return 0;
    }

    case 'check': {
      const doc = loadDraft(a.positional[0]);
      const issues = checkDocument(doc);
      const errors = issues.filter((i) => i.severity === 'error').length;
      if (a.has('json')) json({ 錯誤: errors, 提醒: issues.length - errors, 項目: issues });
      else if (!issues.length) out('沒有發現問題。');
      else {
        const label = { error: '錯誤', warn: '注意', info: '建議' } as const;
        for (const i of issues) out(`[${label[i.severity]}] ${i.where}：${i.message}`);
        out(`\n共 ${issues.length} 項（錯誤 ${errors}）`);
      }
      return errors ? 1 : 0;
    }

    case 'preview': {
      const doc = loadDraft(a.positional[0]);
      out(buildBlocks(doc).map(blockToText).join('\n'));
      return 0;
    }

    case 'normalize': {
      out(serializeDraft(loadDraft(a.positional[0])));
      return 0;
    }

    case 'filename': {
      const doc = loadDraft(a.positional[0]);
      out(exportFileName(doc, a.positional[1] ?? 'pdf'));
      return 0;
    }

    case 'render': {
      const doc = loadDraft(a.positional[0]);
      const format = a.str('format') ?? 'pdf';
      const formats = format === 'all' ? ['pdf', 'odt', 'docx'] : [format];
      for (const f of formats) if (!['pdf', 'odt', 'docx'].includes(f)) throw new UsageError('--format 必須是 pdf、odt、docx 或 all');
      const dir = resolve(a.str('out') ?? '.');
      mkdirSync(dir, { recursive: true });
      const written: string[] = [];
      for (const f of formats) {
        let bytes: Uint8Array;
        if (f === 'pdf') {
          const r = await buildPdf(doc, nodePdfFonts());
          bytes = r.bytes;
          if (r.missing.length) process.stderr.write(`注意：PDF 字體不含以下字元，已略過：${r.missing.join(' ')}\n`);
        } else if (f === 'odt') bytes = await buildOdt(doc);
        else bytes = new Uint8Array(await (await buildDocx(doc)).arrayBuffer());
        const file = join(dir, basename(exportFileName(doc, f)));
        writeFileSync(file, bytes);
        written.push(file);
      }
      json({ 已產生: written });
      return 0;
    }

    case 'deadline': {
      const date = requireDate(a.str('date'));
      const urgency = (a.str('urgency') ?? '普通件') as Urgency;
      if (!(urgency in URGENCY_DAYS)) throw new UsageError('--urgency 必須是 最速件、速件 或 普通件');
      const limit = a.str('limit') ?? '';
      if (limit) requireDate(limit, '--limit');
      const d = processDeadline(date, urgency, limit);
      json({ 收文日: date, 速別: urgency, 限期: limit || null, 辦理期限: d?.due ?? null, 民國: d ? toMinguoText(d.due) : null, 依據: d?.basis === 'limit' ? '限期' : `速別（${d?.days} 個工作天）`, 備註: '只排除週六日，不含國定假日' });
      return 0;
    }

    case 'docnumber': {
      const date = requireDate(a.str('date'));
      const word = a.str('word') ?? defaultWord('函', a.str('sender') ?? '');
      const used = (a.str('used') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      json({ 發文字號: nextDocNumber(word, date, used), 字別: word, 常用字別: COUNCIL_WORDS });
      return 0;
    }

    case 'law': {
      const parsed = parseLaw(readInput(a.positional[0]));
      json(parsed);
      return 0;
    }

    default:
      throw new UsageError(`不認得的指令 ${cmd}；執行 help 查看用法`);
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    process.stderr.write(`${e instanceof UsageError ? '用法錯誤' : '錯誤'}：${e instanceof Error ? e.message : e}\n`);
    process.exit(2);
  },
);

