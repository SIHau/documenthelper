import { useRef, useState } from 'react';
import type { AmendmentRow, DraftMode } from '../model/types';
import { newAmendmentRow } from '../model/defaults';
import { articleText, parseLaw } from '../model/lawText';
import type { Article } from '../model/lawText';

interface Props {
  /** 審查：審查會通過條文｜各提案｜現行條文｜說明 */
  mode: DraftMode | '審查';
  rows: AmendmentRow[];
  onChange: (rows: AmendmentRow[]) => void;
  /** 審查模式的提案名稱，每個提案一欄 */
  proposalNames?: string[];
  reviewer?: string;
}

type Column = [keyof Omit<AmendmentRow, 'id' | 'proposals'>, string, string];
const COLUMNS: Record<DraftMode, Column[]> = {
  修正: [
    ['amended', '修正條文', '修正後的條文全文；刪除條文時留空'],
    ['current', '現行條文', '現行條文全文；新增條文時留空'],
    ['reason', '說明', '修正理由，可分項：一、…'],
  ],
  新訂: [
    ['amended', '條文', '例：第一條　本法依…制定之。'],
    ['reason', '說明', '立法理由，可分項：一、…'],
  ],
};

const IMPORT_HELP: Record<DraftMode | '審查', string> = {
  修正: '選取要修正的條文：「現行條文」填入原條文，「修正條文」先複製一份讓您直接修改。',
  新訂: '選取的條文會依序填入「條文」欄。',
  審查: '選取的條文會填入「現行條文」欄。',
};

/** 把法規純文字（貼上或讀 .txt）解析成條文，挑選後加入對照表 */
function LawImport({ mode, rows, onChange }: { mode: DraftMode | '審查'; rows: AmendmentRow[]; onChange: (rows: AmendmentRow[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (source: string) => {
    const found = parseLaw(source).articles;
    setArticles(found);
    setPicked(new Set(found.map((_, i) => i)));
  };
  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  const add = () => {
    if (!articles) return;
    const added = articles.filter((_, i) => picked.has(i)).map((a): AmendmentRow => {
      const t = articleText(a);
      const row = newAmendmentRow();
      if (mode === '修正') return { ...row, amended: t, current: t };
      if (mode === '新訂') return { ...row, amended: t };
      return { ...row, current: t };
    });
    if (!added.length) return;
    const onlyBlank = rows.length === 1 && !rows[0].amended.trim() && !rows[0].current.trim() && !rows[0].reason.trim();
    onChange([...(onlyBlank ? [] : rows), ...added]);
    setOpen(false);
    setText('');
    setArticles(null);
  };

  if (!open) {
    return <button type="button" className="law-import-toggle" onClick={() => setOpen(true)}>匯入法規文字…</button>;
  }
  return (
    <div className="law-import">
      <p className="hint">貼上從 Word 複製的法規文字，或讀取 .txt 檔；程式會依「第○章」「第○條（標題）」切開，折行的句子自動接回。</p>
      <textarea rows={6} value={text} placeholder="第一條　…&#10;第二條　…" onChange={(e) => { setText(e.target.value); setArticles(null); }} />
      <div className="row-actions">
        <button type="button" onClick={() => parse(text)} disabled={!text.trim()}>解析條文</button>
        <button type="button" onClick={() => fileRef.current?.click()}>讀取 .txt 檔</button>
        <input ref={fileRef} type="file" accept=".txt,text/plain" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const content = await f.text();
            setText(content);
            parse(content);
          }} />
        <button type="button" onClick={() => { setOpen(false); setArticles(null); }}>取消</button>
      </div>
      {articles && (articles.length === 0 ? (
        <p className="hint hint-warn">沒有找到條文。條文需以「第一條」「第二條」這類標題開頭。</p>
      ) : (
        <>
          <p className="hint">找到 {articles.length} 條。{IMPORT_HELP[mode]}</p>
          <div className="law-pick">
            <span className="row-actions">
              <button type="button" onClick={() => setPicked(new Set(articles.map((_, i) => i)))}>全選</button>
              <button type="button" onClick={() => setPicked(new Set())}>全不選</button>
            </span>
            {articles.map((a, i) => (
              <label key={i} className="field-inline">
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                {a.no}{a.title ? `（${a.title}）` : ''}
              </label>
            ))}
          </div>
          <button type="button" className="primary" onClick={add} disabled={picked.size === 0}>加入對照表（{picked.size} 條）</button>
        </>
      ))}
    </div>
  );
}

/** 草案對照表：一列一條，系統自動排成表格（修正三欄、新訂兩欄） */
export function DraftTableEditor({ mode, rows, onChange, proposalNames = [], reviewer = '' }: Props) {
  const field = (key: string, label: string, placeholder: string, value: string, change: (v: string) => void) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <textarea rows={3} value={value} placeholder={placeholder} onChange={(e) => change(e.target.value)} />
    </label>
  );
  const columns = (r: AmendmentRow, i: number) => {
    if (mode !== '審查') {
      return COLUMNS[mode].map(([key, label, placeholder]) =>
        field(key, label, placeholder, r[key], (v) => update(i, { [key]: v })));
    }
    const setProposal = (p: number, v: string) => {
      const proposals = [...(r.proposals ?? [])];
      proposals[p] = v;
      update(i, { proposals });
    };
    return [
      field('amended', `${reviewer.trim() || '審查會'}通過條文`, '審查會通過的條文全文', r.amended, (v) => update(i, { amended: v })),
      ...proposalNames.map((name, p) =>
        field(`p${p}`, `${name.trim() || `第 ${p + 1} 個`}提案`, '該提案的條文；未修正時留空', r.proposals?.[p] ?? '', (v) => setProposal(p, v))),
      field('current', '現行條文', '現行條文全文；新增條文時留空', r.current, (v) => update(i, { current: v })),
      field('reason', '說明', '審查說明，可分項：一、…', r.reason, (v) => update(i, { reason: v })),
    ];
  };
  const update = (index: number, patch: Partial<AmendmentRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const insertAfter = (index: number) => {
    const next = [...rows];
    next.splice(index + 1, 0, newAmendmentRow());
    onChange(next);
  };

  return (
    <div className="amendment">
      <LawImport mode={mode} rows={rows} onChange={onChange} />
      {rows.map((r, i) => (
        <div className="amendment-row" key={r.id}>
          <div className="amendment-head">
            <span>第 {i + 1} 列</span>
            <span className="outline-actions">
              <button type="button" title="上移" onClick={() => move(i, -1)}>↑</button>
              <button type="button" title="下移" onClick={() => move(i, 1)}>↓</button>
              <button type="button" title="在下方新增" onClick={() => insertAfter(i)}>＋</button>
              <button type="button" title="刪除" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
          {columns(r, i)}
        </div>
      ))}
      {rows.length === 0 && (
        <button type="button" onClick={() => onChange([newAmendmentRow()])}>＋ 新增一列</button>
      )}
    </div>
  );
}
