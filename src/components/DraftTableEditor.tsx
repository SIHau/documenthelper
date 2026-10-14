import type { AmendmentRow, DraftMode } from '../model/types';
import { newAmendmentRow } from '../model/defaults';

interface Props {
  mode: DraftMode;
  rows: AmendmentRow[];
  onChange: (rows: AmendmentRow[]) => void;
}

type Column = [keyof Omit<AmendmentRow, 'id'>, string, string];
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
export function DraftTableEditor({ mode, rows, onChange }: Props) {
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
          {COLUMNS[mode].map(([key, label, placeholder]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea rows={3} value={r[key]} placeholder={placeholder}
                onChange={(e) => update(i, { [key]: e.target.value })} />
            </label>
          ))}
        </div>
      ))}
      {rows.length === 0 && (
        <button type="button" onClick={() => onChange([newAmendmentRow()])}>＋ 新增一列</button>
      )}
    </div>
  );
}
