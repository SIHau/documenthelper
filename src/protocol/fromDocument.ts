import { strToU8 } from 'fflate';
import type { OfficialDocument } from '../model/types';
import { canonicalize } from './jcs';
import { createPackage } from './package';
import type { DocumentPackage, PackageFile } from './package';
import type { KeyPair } from './keys';

/** 結構化內容的 MIME；content.json 就是公文小幫手的稿件 JSON */
export const CONTENT_MEDIA_TYPE = 'application/vnd.documenthelper.document+json';

/** 正本受文者：受文者加上「正本」欄位，去除重複 */
function recipients(doc: OfficialDocument): Array<{ name: string; code?: string }> {
  const names = [doc.recipient.name, ...doc.primaryRecipients.split(/[、，,\n]/)].map((s) => s.trim()).filter(Boolean);
  return [...new Set(names)].map((name) => (name === doc.recipient.name && doc.recipient.code ? { name, code: doc.recipient.code } : { name }));
}

/** 把一份稿件與它的 PDF 打包成已簽署的文件包 */
export function packageDocument(
  doc: OfficialDocument,
  pdf: Uint8Array,
  opts: { key: KeyPair; actor: string; now: string; generatorVersion: string; attachments?: PackageFile[] },
): DocumentPackage {
  return createPackage(
    {
      docType: doc.type,
      title: doc.subject.trim() || doc.type,
      docNumber: doc.docNumber.trim() || undefined,
      from: doc.sender.code ? { name: doc.sender.name, code: doc.sender.code } : { name: doc.sender.name },
      to: recipients(doc),
      files: [
        { path: 'content.json', role: 'content', mediaType: CONTENT_MEDIA_TYPE, bytes: strToU8(canonicalize(doc)) },
        { path: 'document.pdf', role: 'rendering', mediaType: 'application/pdf', bytes: pdf },
        ...(opts.attachments ?? []),
      ],
      generator: { name: 'documenthelper', version: opts.generatorVersion },
      actor: opts.actor,
      now: opts.now,
    },
    opts.key,
  );
}
