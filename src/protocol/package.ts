import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { canonicalize } from './jcs';
import { sha256Id } from './encoding';
import { eventId, signEvent } from './event';
import type { SignedEvent } from './event';
import type { KeyPair } from './keys';
import { buildManifest, docId, fileEntry } from './manifest';
import type { FileRole, Manifest } from './manifest';
import { EVENT_LABELS, STATE_LABELS, deriveState } from './state';
import type { DocState, EventCheck } from './state';

/** 文件包副檔名與 MIME；內容是 zip */
export const PACKAGE_EXT = 'sgdoc';
export const PACKAGE_MIME = 'application/vnd.studentgov.document+zip';

const MANIFEST_PATH = 'manifest.json';
const EVENTS_DIR = 'events/';

export interface PackageFile {
  path: string;
  role: FileRole;
  mediaType: string;
  bytes: Uint8Array;
}

export interface NewPackage {
  docType: string;
  title: string;
  docNumber?: string;
  from: Manifest['from'];
  to: Manifest['to'];
  files: PackageFile[];
  generator: Manifest['generator'];
  /** 發文者識別碼（P2 起為學校帳號背書的 person:…） */
  actor: string;
  asRole?: string;
  now: string;
}

/**
 * 「系統倒了公文不倒」的那個檔案：清單、內容、PDF、附件與相關事件都在同一個 zip 裡，
 * 不需要任何伺服器就能驗證。
 */
export interface DocumentPackage {
  docId: string;
  manifest: Manifest;
  files: Map<string, Uint8Array>;
  events: SignedEvent[];
}

/** 建立文件包並由發文者簽署發文事件 */
export function createPackage(p: NewPackage, key: KeyPair): DocumentPackage {
  const manifest = buildManifest({
    docType: p.docType,
    title: p.title,
    docNumber: p.docNumber || undefined,
    from: p.from,
    to: p.to,
    files: p.files.map((f) => fileEntry(f.path, f.role, f.mediaType, f.bytes)),
    generator: p.generator,
    createdAt: p.now,
  });
  const id = docId(manifest);
  const sent = signEvent(
    {
      type: 'doc.sent',
      subject: id,
      actor: p.actor,
      asRole: p.asRole,
      prev: [],
      claimedAt: p.now,
      body: { to: p.to.map((t) => t.name) },
    },
    key,
  );
  return { docId: id, manifest, files: new Map(p.files.map((f) => [f.path, f.bytes])), events: [sent] };
}

/** 目前事件圖的末端（沒有被其他事件引用的事件），作為下一筆事件的 prev */
export function heads(events: SignedEvent[]): string[] {
  const referenced = new Set(events.flatMap((e) => e.prev));
  return events.map(eventId).filter((id) => !referenced.has(id)).sort();
}

/** 在文件包上追加一筆事件（送達 Receipt、收文 Receipt、分派…），回傳新的文件包 */
export function appendEvent(
  pkg: DocumentPackage,
  e: { type: SignedEvent['type']; actor: string; asRole?: string; claimedAt: string; body?: SignedEvent['body'] },
  key: KeyPair,
): DocumentPackage {
  const signed = signEvent({ ...e, subject: pkg.docId, prev: heads(pkg.events), body: e.body ?? {} }, key);
  return mergeEvents(pkg, [signed]);
}

/** 合併另一方傳回的事件（例：收文方回傳的收文 Receipt）；同一筆事件只保留一份 */
export function mergeEvents(pkg: DocumentPackage, events: SignedEvent[]): DocumentPackage {
  const all = new Map(pkg.events.map((e) => [eventId(e), e]));
  for (const e of events) if (!all.has(eventId(e)) || (e.witness && !all.get(eventId(e))!.witness)) all.set(eventId(e), e);
  return { ...pkg, events: [...all.values()] };
}

export function writePackage(pkg: DocumentPackage): Uint8Array {
  const entries: Record<string, Uint8Array> = { [MANIFEST_PATH]: strToU8(canonicalize(pkg.manifest)) };
  for (const [path, bytes] of pkg.files) entries[path] = bytes;
  for (const e of pkg.events) entries[`${EVENTS_DIR}${eventId(e).replace(/^event:sha256:/, '')}.json`] = strToU8(canonicalize(e));
  // 固定時間戳，讓同樣內容的文件包產生同樣的位元組
  return zipSync(entries, { level: 6, mtime: new Date('2000-01-01T00:00:00Z') });
}

export function readPackage(bytes: Uint8Array): DocumentPackage {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('不是有效的文件包（無法解壓縮）');
  }
  const raw = entries[MANIFEST_PATH];
  if (!raw) throw new Error('文件包缺少 manifest.json');
  const manifest = JSON.parse(strFromU8(raw)) as Manifest;
  if (manifest?.type !== 'studentgov.document' || !Array.isArray(manifest.files)) throw new Error('manifest.json 格式不正確');
  const files = new Map<string, Uint8Array>();
  const events: SignedEvent[] = [];
  for (const [path, data] of Object.entries(entries)) {
    if (path === MANIFEST_PATH || path.endsWith('/')) continue;
    if (path.startsWith(EVENTS_DIR)) events.push(JSON.parse(strFromU8(data)) as SignedEvent);
    else files.set(path, data);
  }
  return { docId: docId(manifest), manifest, files, events };
}

export interface PackageReport {
  docId: string;
  manifest: Manifest;
  /** ✓ 文件完整：所有檔案 hash 與清單一致 */
  integrity: { ok: boolean; problems: string[] };
  /** ✓ 文件來源已驗證：有一筆有效的發文事件（P2 起再檢查金鑰背書與 Role） */
  source: { ok: boolean; actor?: string; key?: string; asRole?: string; at?: string; problems: string[] };
  /** ✓ 已正式送達：有一筆有效的收文 Receipt */
  delivery: {
    ok: boolean;
    state: DocState | null;
    stateLabel: string;
    delivered?: { actor: string; at: string };
    received?: { actor: string; asRole?: string; at: string; receiptNumber?: string };
  };
  events: Array<EventCheck & { label: string; at: string; witnessed: boolean }>;
}

export function verifyPackage(pkg: DocumentPackage): PackageReport {
  const problems: string[] = [];
  const listed = new Set(pkg.manifest.files.map((f) => f.path));
  for (const f of pkg.manifest.files) {
    const data = pkg.files.get(f.path);
    if (!data) problems.push(`缺少檔案 ${f.path}`);
    else if (data.length !== f.size || sha256Id(data) !== f.sha256) problems.push(`檔案 ${f.path} 與清單不符（可能被修改過）`);
  }
  for (const path of pkg.files.keys()) if (!listed.has(path)) problems.push(`清單沒有列出的檔案 ${path}`);

  const d = deriveState(pkg.docId, pkg.events);
  const sent = d.events.find((c) => c.valid && c.event.type === 'doc.sent');
  const sourceProblems = sent ? [] : ['沒有有效的發文簽章'];
  for (const c of d.events) if (!c.valid && c.event.type === 'doc.sent') sourceProblems.push(`發文事件無效：${c.problem}`);

  const at = (e: SignedEvent) => e.witness?.at ?? e.claimedAt;
  return {
    docId: pkg.docId,
    manifest: pkg.manifest,
    integrity: { ok: problems.length === 0, problems },
    source: {
      ok: !!sent,
      actor: sent?.event.actor,
      key: sent?.event.actorKey,
      asRole: sent?.event.asRole,
      at: sent ? at(sent.event) : undefined,
      problems: sourceProblems,
    },
    delivery: {
      ok: !!d.received,
      state: d.state,
      stateLabel: d.state ? STATE_LABELS[d.state] : '無法判定',
      delivered: d.delivered && { actor: d.delivered.actor, at: at(d.delivered) },
      received: d.received && {
        actor: d.received.actor,
        asRole: d.received.asRole,
        at: at(d.received),
        receiptNumber: typeof d.received.body.receiptNumber === 'string' ? d.received.body.receiptNumber : undefined,
      },
    },
    events: d.events.map((c) => ({ ...c, label: EVENT_LABELS[c.event.type] ?? c.event.type, at: at(c.event), witnessed: !!c.event.witness })),
  };
}

/** 檔名用的短 id：doc hash 前 12 碼 */
export const shortDocId = (id: string) => id.replace(/^doc:sha256:/, '').slice(0, 12);
