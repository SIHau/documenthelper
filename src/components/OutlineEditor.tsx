import type { OutlineItem } from '../model/types';
import { newItem } from '../model/defaults';
import { MAX_LEVEL, numberItems } from '../model/numbering';

interface Props {
  items: OutlineItem[];
  onChange: (items: OutlineItem[]) => void;
}

export function OutlineEditor({ items, onChange }: Props) {
  const numbered = numberItems(items);

  const update = (index: number, patch: Partial<OutlineItem>) =>
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const insertAfter = (index: number) => {
    const level = numbered[index]?.level ?? 0;
    const next = [...items];
    next.splice(index + 1, 0, newItem(level));
    onChange(next);
  };

  return (
    <div className="outline">
      {numbered.map((it, i) => (
        <div className="outline-row" key={it.id} style={{ marginLeft: it.level * 20 }}>
          <span className="outline-label">{it.label}</span>
          <textarea
            value={it.text}
            rows={2}
            onChange={(e) => update(i, { text: e.target.value })}
          />
          <div className="outline-actions">
            <button type="button" title="降一層" disabled={it.level >= MAX_LEVEL}
              onClick={() => update(i, { level: it.level + 1 })}>→</button>
            <button type="button" title="升一層" disabled={it.level <= 0}
              onClick={() => update(i, { level: it.level - 1 })}>←</button>
            <button type="button" title="上移" onClick={() => move(i, -1)}>↑</button>
            <button type="button" title="下移" onClick={() => move(i, 1)}>↓</button>
            <button type="button" title="在下方新增" onClick={() => insertAfter(i)}>＋</button>
            <button type="button" title="刪除" onClick={() => remove(i)}>✕</button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <button type="button" onClick={() => onChange([newItem()])}>＋ 新增一項</button>
      )}
    </div>
  );
}
