import JSZip from 'jszip';
import type { OfficialDocument } from '../model/types';
import { BODY_FONT, BODY_SIZE, SIGNATURE_FONTS, buildBlocks } from './layout';
import type { Block, Run } from './layout';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 保留連續空白與換行（ODF 需明確標示） */
function textNodes(text: string): string {
  return esc(text)
    .replace(/\r?\n/g, '<text:line-break/>')
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`);
}

const NS = `xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
 xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"`;

const fontFace = (name: string) =>
  `<style:font-face style:name="${esc(name)}" svg:font-family="'${esc(name)}'" style:font-family-generic="roman"/>`;

function fontDecls(): string {
  const names = new Set([BODY_FONT, ...Object.values(SIGNATURE_FONTS)]);
  return `<office:font-face-decls>${[...names].map(fontFace).join('')}</office:font-face-decls>`;
}

const ALIGN = { left: 'start', center: 'center', right: 'end' } as const;

interface Styles {
  paragraphs: string[];
  spans: string[];
}

function build(blocks: Block[]): { body: string; auto: string } {
  const st: Styles = { paragraphs: [], spans: [] };
  const spanIndex = new Map<string, string>();

  const spanStyle = (r: Run): string | null => {
    const props = [
      r.bold ? 'fo:font-weight="bold" style:font-weight-asian="bold"' : '',
      r.size ? `fo:font-size="${r.size}pt" style:font-size-asian="${r.size}pt"` : '',
      r.color ? `fo:color="#${r.color}"` : '',
      r.font
        ? `style:font-name="${esc(r.font)}" style:font-name-asian="${esc(r.font)}"`
        : '',
    ].filter(Boolean).join(' ');
    if (!props) return null;
    let name = spanIndex.get(props);
    if (!name) {
      name = `T${spanIndex.size + 1}`;
      spanIndex.set(props, name);
      st.spans.push(
        `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`,
      );
    }
    return name;
  };

  const body = blocks
    .map((b, i) => {
      const name = `P${i + 1}`;
      const props = [
        `fo:text-align="${ALIGN[b.align ?? 'left']}"`,
        b.indentEm ? `fo:margin-left="${b.indentEm}em"` : '',
        b.hangingEm ? `fo:text-indent="-${b.hangingEm}em"` : '',
        `fo:margin-top="${b.spaceBefore ?? 0}pt"`,
        'fo:margin-bottom="0pt"',
      ].filter(Boolean).join(' ');
      st.paragraphs.push(
        `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard">` +
          `<style:paragraph-properties ${props}/></style:style>`,
      );
      const runs = b.runs
        .filter((r) => r.text)
        .map((r) => {
          const s = spanStyle(r);
          const t = textNodes(r.text);
          return s ? `<text:span text:style-name="${s}">${t}</text:span>` : t;
        })
        .join('');
      return `<text:p text:style-name="${name}">${runs}</text:p>`;
    })
    .join('\n');

  return { body, auto: st.paragraphs.join('\n') + '\n' + st.spans.join('\n') };
}

function contentXml(doc: OfficialDocument): string {
  const { body, auto } = build(buildBlocks(doc));
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.2">
${fontDecls()}
<office:automatic-styles>
${auto}
</office:automatic-styles>
<office:body><office:text>
${body}
</office:text></office:body>
</office:document-content>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.2">
${fontDecls()}
<office:styles>
<style:default-style style:family="paragraph">
<style:paragraph-properties fo:line-height="160%"/>
<style:text-properties style:font-name="${BODY_FONT}" style:font-name-asian="${BODY_FONT}" style:font-name-complex="${BODY_FONT}" fo:font-size="${BODY_SIZE}pt" style:font-size-asian="${BODY_SIZE}pt" fo:language="zh" fo:country="TW" style:language-asian="zh" style:country-asian="TW"/>
</style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1">
<style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2.5cm" fo:margin-bottom="2.5cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
</style:page-layout>
</office:automatic-styles>
<office:master-styles>
<style:master-page style:name="Standard" style:page-layout-name="pm1"/>
</office:master-styles>
</office:document-styles>`;
}

function metaXml(doc: OfficialDocument): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NS} office:version="1.2"><office:meta>
<dc:title>${esc(doc.subject)}</dc:title>
<meta:generator>documenthelper</meta:generator>
</office:meta></office:document-meta>`;
}

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

export const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/** 產生 ODT（ODF 1.2）。mimetype 必須是壓縮檔第一個項目且不壓縮。 */
export async function buildOdt(doc: OfficialDocument): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', ODT_MIME, { compression: 'STORE' });
  zip.file('content.xml', contentXml(doc));
  zip.file('styles.xml', stylesXml());
  zip.file('meta.xml', metaXml(doc));
  zip.file('META-INF/manifest.xml', MANIFEST);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: ODT_MIME });
}
