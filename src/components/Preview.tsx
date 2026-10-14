import type { CSSProperties } from 'react';
import type { OfficialDocument } from '../model/types';
import { buildBlocks, hasBindingLine, marginXcm, pageHeader } from '../export/layout';
import type { Block, Run, Table } from '../export/layout';

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
    // 整段都是小字（如檔號、發文日期）時，行高跟著縮小
    fontSize: b.runs.every((r) => r.size && r.size < 16) ? `${Math.max(...b.runs.map((r) => r.size!))}pt` : undefined,
  };
}

function PreviewTable({ table, spaceBefore }: { table: Table; spaceBefore?: number }) {
  return (
    <table className="pv-table" style={{ fontSize: `${table.size}pt`, marginTop: spaceBefore ? `${spaceBefore}pt` : undefined }}>
      <colgroup>
        {table.columns.map((w, i) => <col key={i} style={{ width: `${w * 100}%` }} />)}
      </colgroup>
      {table.header.length > 0 && (
        <thead>
          <tr>{table.header.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i} style={{ height: table.rowHeight ? `${table.rowHeight}pt` : undefined }}>
            {row.map((c, j) => (
              <td key={j} style={table.center ? { textAlign: 'center', verticalAlign: 'middle' } : undefined}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 預覽與匯出共用同一份版面資料，確保所見即所得；遇到分頁區塊就另起一張紙 */
export function Preview({ doc }: { doc: OfficialDocument }) {
  const header = pageHeader(doc);
  const binding = hasBindingLine(doc);
  const pad = { '--mx': `${marginXcm(doc) * 10}mm` } as CSSProperties;
  const pages: Block[][] = [[]];
  for (const b of buildBlocks(doc)) {
    if (b.pageBreakBefore && pages[pages.length - 1].length) pages.push([]);
    pages[pages.length - 1].push(b);
  }
  return (
    <>
      {pages.map((blocks, pi) => (
        <article className="page" key={pi} style={pad}>
          {binding && pi === 0 && (
            <div className="pv-binding" aria-hidden="true"><span>裝</span><span>訂</span><span>線</span></div>
          )}
          {header && <p className="pv-header">{header}</p>}
          {blocks.map((b, i) => b.table ? (
            <PreviewTable key={i} table={b.table} spaceBefore={b.spaceBefore} />
          ) : (
            <p key={i} className="pv-p" style={blockStyle(b)}>
              {b.runs
                .filter((r) => r.text)
                .map((r, j) => (
                  <span key={j} style={runStyle(r)}>{r.text}</span>
                ))}
            </p>
          ))}
        </article>
      ))}
    </>
  );
}
