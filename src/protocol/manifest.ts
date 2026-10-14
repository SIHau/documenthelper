import { canonicalize } from './jcs';
import { sha256Id, utf8ToBytes } from './encoding';
import { PROTOCOL_VERSION } from './event';

export type FileRole = 'content' | 'rendering' | 'attachment';

export interface ManifestFile {
  /** 文件包內的路徑，例：content.json、document.pdf、attachments/附件一.pdf */
  path: string;
  role: FileRole;
  mediaType: string;
  size: number;
  sha256: string;
}

export interface Party {
  name: string;
  /** 機關代碼；P2 起改為 organ:… 識別碼 */
  code?: string;
}

/**
 * 文件包的清單。文件 id 就是清單 JCS 的 hash，所以清單內任何一個位元組
 * （包含 PDF 或附件的 hash）改變，文件 id 就跟著改變，原本的簽章也就對不上。
 */
export interface Manifest {
  v: number;
  type: 'studentgov.document';
  docType: string;
  title: string;
  docNumber?: string;
  from: Party;
  to: Party[];
  files: ManifestFile[];
  /** 產生 rendering 的程式與版本，驗證端可用同版本重新排版比對 */
  generator: { name: string; version: string };
  createdAt: string;
}

export function fileEntry(path: string, role: FileRole, mediaType: string, bytes: Uint8Array): ManifestFile {
  return { path, role, mediaType, size: bytes.length, sha256: sha256Id(bytes) };
}

export function buildManifest(m: Omit<Manifest, 'v' | 'type'>): Manifest {
  const paths = new Set<string>();
  for (const f of m.files) {
    if (!/^[^/\\][^\\]*$/.test(f.path) || f.path.split('/').includes('..')) throw new Error(`檔案路徑不合法：${f.path}`);
    if (paths.has(f.path)) throw new Error(`檔案路徑重複：${f.path}`);
    paths.add(f.path);
  }
  if (m.files.filter((f) => f.role === 'content').length !== 1) throw new Error('文件包必須剛好有一個 content 檔案');
  return { v: PROTOCOL_VERSION, type: 'studentgov.document', ...m };
}

/** doc:sha256:… */
export function docId(m: Manifest): string {
  return `doc:${sha256Id(utf8ToBytes(canonicalize(m)))}`;
}
