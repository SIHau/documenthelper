import { AlignmentType, BorderStyle, Document, Footer, Header, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { OfficialDocument } from '../model/types';
import { BODY_FONT, BODY_SIZE, PAGE_NUMBER_PARTS, buildBlocks, hasPageNumbers, marginXcm, pageHeader } from './layout';
import type { Block, Table as TableSpec } from './layout';

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
} as const;

/** 1em（以本文 16pt 計）= 320 twips */
const EM_TWIPS = BODY_SIZE * 20;
const CM_TWIPS = 567;
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

function paragraph(b: Block): Paragraph {
  return new Paragraph({
    alignment: ALIGN[b.align ?? 'left'],
    pageBreakBefore: b.pageBreakBefore,
    spacing: { before: (b.spaceBefore ?? 0) * 20, line: 384 },
    indent: b.indentEm
      ? {
          left: Math.round(b.indentEm * EM_TWIPS),
          hanging: b.hangingEm ? Math.round(b.hangingEm * EM_TWIPS) : undefined,
        }
      : undefined,
    children: b.runs
      .filter((r) => r.text)
      .map(
        (r) =>
          new TextRun({
            text: r.text,
            bold: r.bold,
            size: (r.size ?? BODY_SIZE) * 2,
            color: r.color,
            font: { ascii: r.font ?? BODY_FONT, eastAsia: r.font ?? BODY_FONT, hAnsi: r.font ?? BODY_FONT },
          }),
      ),
  });
}

function cell(text: string, width: number, size: number, header: boolean): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: text.split('\n').map(
      (line) =>
        new Paragraph({
          alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 384 },
          children: [new TextRun({ text: line, bold: header, size: size * 2 })],
        }),
    ),
  });
}

function table(t: TableSpec, contentTwips: number): Table {
  const widths = t.columns.map((f) => Math.round(f * contentTwips));
  return new Table({
    width: { size: contentTwips, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE },
    rows: [t.header, ...t.rows].map(
      (row, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          children: row.map((text, ci) => cell(text, widths[ci], t.size, ri === 0)),
        }),
    ),
  });
}

/** 表格前的段前距以空段落表示 */
function nodes(b: Block, contentTwips: number): Array<Paragraph | Table> {
  if (!b.table) return [paragraph(b)];
  return [new Paragraph({ spacing: { before: (b.spaceBefore ?? 0) * 20, line: 240 }, children: [] }), table(b.table, contentTwips)];
}

export async function buildDocx(doc: OfficialDocument): Promise<Blob> {
  const headerText = pageHeader(doc);
  const mx = Math.round(marginXcm(doc) * CM_TWIPS);
  const contentTwips = 11906 - mx * 2;
  const file = new Document({
    title: doc.subject,
    creator: 'documenthelper',
    styles: {
      default: {
        document: {
          run: { font: { ascii: BODY_FONT, eastAsia: BODY_FONT }, size: BODY_SIZE * 2 },
        },
      },
    },
    sections: [
      {
        headers: headerText
          ? {
              default: new Header({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerText, size: 24 })] }),
                ],
              }),
            }
          : undefined,
        footers: hasPageNumbers(doc)
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    // 每段各自設字級，頁碼欄位才不會沿用本文 16pt
                    children: [PAGE_NUMBER_PARTS[0], PageNumber.CURRENT, PAGE_NUMBER_PARTS[1], PageNumber.TOTAL_PAGES, PAGE_NUMBER_PARTS[2]].map(
                      (part) => new TextRun({ size: 20, children: [part] }),
                    ),
                  }),
                ],
              }),
            }
          : undefined,
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1418, bottom: 1418, left: mx, right: mx, header: 851, footer: 680 },
          },
        },
        children: buildBlocks(doc).flatMap((b) => nodes(b, contentTwips)),
      },
    ],
  });
  return Packer.toBlob(file);
}
