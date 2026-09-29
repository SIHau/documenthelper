import type { Direction } from '../model/types';
import { EXPECTATIONS, PHRASE_GROUPS } from '../data/phrases';

interface Props {
  direction: Direction;
  onInsert: (text: string) => void;
  /** 目前是否有可插入的欄位 */
  hasTarget: boolean;
}

export function PhrasePanel({ direction, onInsert, hasTarget }: Props) {
  const groups = [{ id: 'expect', title: `期望語（${direction}文）`, phrases: EXPECTATIONS[direction] }, ...PHRASE_GROUPS];
  return (
    <div className="phrases">
      <p className={hasTarget ? 'hint' : 'hint hint-warn'}>
        {hasTarget ? '點選用語，會插入到左側游標所在位置。' : '請先在左側點選要插入的文字欄位。'}
      </p>
      {groups.map((g) => (
        <section key={g.id}>
          <h3>{g.title}</h3>
          <div className="chips">
            {g.phrases.map((p) => (
              // mouseDown 阻止預設行為，避免按鈕搶走輸入框焦點與游標位置
              <button key={p} type="button" className="chip"
                onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(p)}>
                {p}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
