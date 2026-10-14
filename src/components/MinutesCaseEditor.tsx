import type { MinutesCase } from '../model/types';
import { newMinutesCase } from '../model/defaults';
import { toChineseNumber } from '../model/numbering';

interface Props {
  cases: MinutesCase[];
  onChange: (cases: MinutesCase[]) => void;
}

const FIELDS: Array<[keyof Omit<MinutesCase, 'id'>, string, string, boolean]> = [
  ['proposer', '提案人', '例：法制委員會', false],
  ['subject', '案由', '', false],
  ['explanation', '說明（每行一點）', '', true],
  ['resolution', '決議（每行一點）', '例：照案通過。', true],
];

/** 會議紀錄的討論事項：逐案填寫提案人、案由、說明、決議 */
export function MinutesCaseEditor({ cases, onChange }: Props) {
  const update = (index: number, patch: Partial<MinutesCase>) =>
    onChange(cases.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= cases.length) return;
    const next = [...cases];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const insertAfter = (index: number) => {
    const next = [...cases];
    next.splice(index + 1, 0, newMinutesCase());
    onChange(next);
  };

  return (
    <div className="amendment">
      {cases.map((c, i) => (
        <div className="amendment-row" key={c.id}>
          <div className="amendment-head">
            <span>第{toChineseNumber(i + 1)}案</span>
            <span className="outline-actions">
              <button type="button" title="上移" onClick={() => move(i, -1)}>↑</button>
              <button type="button" title="下移" onClick={() => move(i, 1)}>↓</button>
              <button type="button" title="在下方新增" onClick={() => insertAfter(i)}>＋</button>
              <button type="button" title="刪除" onClick={() => onChange(cases.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
          {FIELDS.map(([key, label, placeholder, multi]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              {multi ? (
                <textarea rows={3} value={c[key]} placeholder={placeholder} onChange={(e) => update(i, { [key]: e.target.value })} />
              ) : (
                <input value={c[key]} placeholder={placeholder} onChange={(e) => update(i, { [key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
      ))}
      {cases.length === 0 && (
        <button type="button" onClick={() => onChange([newMinutesCase()])}>＋ 新增一案</button>
      )}
    </div>
  );
}
