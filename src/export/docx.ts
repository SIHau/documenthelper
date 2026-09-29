import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import type { OfficialDocument } from '../model/types';
import { BODY_FONT, BODY_SIZE, buildBlocks } from './layout';
import type { Block } from './layout';

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
} as const;

/** 1em（以本文 16pt 計）= 320 twips */
const EM_TWIPS = BODY_SIZE * 20;

function paragraph(b: Block): Paragraph {
  return new Paragraph({
    alignment: ALIGN[b.align ?? 'left'],
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

export async function buildDocx(doc: OfficialDocument): Promise<Blob> {
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
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1418, bottom: 1418, left: 1134, right: 1134 },
          },
        },
        children: buildBlocks(doc).map(paragraph),
      },
    ],
  });
  return Packer.toBlob(file);
}
