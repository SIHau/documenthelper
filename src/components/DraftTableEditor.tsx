import type { AmendmentRow, DraftMode } from '../model/types';
import { newAmendmentRow } from '../model/defaults';

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
