import type { CSSProperties } from 'react';
import type { OfficialDocument } from '../model/types';
import { buildBlocks, pageHeader } from '../export/layout';
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
  };
}

function PreviewTable({ table, spaceBefore }: { table: Table; spaceBefore?: number }) {
  return (
    <table className="pv-table" style={{ fontSize: `${table.size}pt`, marginTop: spaceBefore ? `${spaceBefore}pt` : undefined }}>
      <colgroup>
        {table.columns.map((w, i) => <col key={i} style={{ width: `${w * 100}%` }} />)}
      </colgroup>
      <thead>
        <tr>{table.header.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

/** 預覽與匯出共用同一份版面資料，確保所見即所得；遇到分頁區塊就另起一張紙 */
export function Preview({ doc }: { doc: OfficialDocument }) {
  const header = pageHeader(doc);
  const pages: Block[][] = [[]];
  for (const b of buildBlocks(doc)) {
    if (b.pageBreakBefore && pages[pages.length - 1].length) pages.push([]);
    pages[pages.length - 1].push(b);
  }
  return (
    <>
      {pages.map((blocks, pi) => (
        <article className="page" key={pi}>
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
