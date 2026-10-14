import type { BudgetItem } from '../model/types';
import { newBudgetItem } from '../model/defaults';
import { formatAmount, parseAmount } from '../model/amount';

interface Props {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
}

const FIELDS: Array<[keyof Omit<BudgetItem, 'id'>, string, string]> = [
  ['unit', '處室', '例：秘書處'],
  ['name', '項目', '例：影印費'],
  ['code', '編號', '會計科目編號'],
  ['amount', '費用（元）', '例：1200'],
];

/** 概算表：一列一個項目，合計自動計算 */
export function BudgetItemEditor({ items, onChange }: Props) {
  const update = (index: number, patch: Partial<BudgetItem>) =>
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  // 新增的列沿用同一處室，方便連續輸入
  const insertAfter = (index: number) => {
    const next = [...items];
    next.splice(index + 1, 0, newBudgetItem(items[index]?.unit ?? ''));
    onChange(next);
  };
  const total = items.reduce((sum, it) => sum + (parseAmount(it.amount) ?? 0), 0);

  return (
    <div className="amendment">
      {items.map((it, i) => (
        <div className="amendment-row" key={it.id}>
          <div className="amendment-head">
            <span>第 {i + 1} 項</span>
            <span className="outline-actions">
              <button type="button" title="上移" onClick={() => move(i, -1)}>↑</button>
              <button type="button" title="下移" onClick={() => move(i, 1)}>↓</button>
              <button type="button" title="在下方新增" onClick={() => insertAfter(i)}>＋</button>
              <button type="button" title="刪除" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
          <div className="grid">
            {FIELDS.map(([key, label, placeholder]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input value={it[key]} placeholder={placeholder} inputMode={key === 'amount' ? 'numeric' : undefined}
                  onChange={(e) => update(i, { [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="field">
            <span>說明</span>
            <textarea rows={2} value={it.note} placeholder="用途或明細，可換行"
              onChange={(e) => update(i, { note: e.target.value })} />
          </label>
        </div>
      ))}
      {items.length === 0 && (
        <button type="button" onClick={() => onChange([newBudgetItem()])}>＋ 新增一項</button>
      )}
      <p className="hint">合計：{formatAmount(total)} 元</p>
    </div>
  );
}
