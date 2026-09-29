import type { CSSProperties } from 'react';
import type { OfficialDocument } from '../model/types';
import { buildBlocks } from '../export/layout';
import type { Block, Run } from '../export/layout';

function runStyle(r: Run): CSSProperties {
  return {
    fontWeight: r.bold ? 700 : undefined,
    fontSize: r.size ? `${r.size}pt` : undefined,
    color: r.color ? `#${r.color}` : undefined,
    fontFamily: r.font ? `"${r.font}", "標楷體", serif` : undefined,
  };
}

function blockStyle(b: Block): CSSProperties {
  return {
    textAlign: b.align ?? 'left',
    marginLeft: b.indentEm ? `${b.indentEm}em` : undefined,
    textIndent: b.hangingEm ? `-${b.hangingEm}em` : undefined,
    marginTop: b.spaceBefore ? `${b.spaceBefore}pt` : undefined,
  };
}

/** 預覽與匯出共用同一份版面資料，確保所見即所得 */
export function Preview({ doc }: { doc: OfficialDocument }) {
  return (
    <article className="page">
      {buildBlocks(doc).map((b, i) => (
        <p key={i} className="pv-p" style={blockStyle(b)}>
          {b.runs
            .filter((r) => r.text)
            .map((r, j) => (
              <span key={j} style={runStyle(r)}>{r.text}</span>
            ))}
        </p>
      ))}
    </article>
  );
}
