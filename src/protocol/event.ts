import { canonicalize } from './jcs';
import type { Json } from './jcs';
import { sha256Id, utf8ToBytes } from './encoding';
import { signText, verifyText } from './keys';
import type { KeyPair } from './keys';

export const PROTOCOL_VERSION = 1;
const EVENT_DOMAIN = 'studentgov/event/v1';
const WITNESS_DOMAIN = 'studentgov/witness/v1';

/**
 * 公文送達相關的事件類型。每一個狀態變化都是一筆簽章事件，狀態本身不另外儲存。
 * - doc.sent       發文：發文者簽署文件包（subject 即 manifest hash）
 * - doc.delivered  送達：中繼或收文方裝置自動簽發的機器 Receipt，證明密文已進入收文信箱
 * - doc.received   正式收文：收文承辦人簽收，處理時限自此起算
 * - doc.assigned / doc.progress / doc.replied / doc.closed  分派、處理進度、回覆、結案
 * - doc.withdrawn  撤回：發文方於收文前撤回
 * - doc.returned   退文：收文方認為管轄或格式不對，必須附理由
 */
export const EVENT_TYPES = [
  'doc.sent',
  'doc.delivered',
  'doc.received',
  'doc.assigned',
  'doc.progress',
  'doc.replied',
  'doc.closed',
  'doc.withdrawn',
  'doc.returned',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 事件中簽章涵蓋的部分 */
export interface UnsignedEvent {
  v: number;
  type: EventType;
  /** doc:sha256:… 文件包 manifest 的 hash */
  subject: string;
  /** 行為人，例：person:google:1043…；中繼為 relay:<主機名稱> */
  actor: string;
  /** 簽章用的裝置鑰 ed25519:… */
  actorKey: string;
  /** 以什麼身分行為，例：organ:student-council/clerk（P2 起依 Policy 驗證） */
  asRole?: string;
  /** 依據的 Governance Policy 版本（P2） */
  policy?: string;
  /** 本機已知的最新事件 id；發文事件為空陣列 */
  prev: string[];
  /** 行為人自報時間（ISO 8601，含時區）；正式時間以中繼見證為準 */
  claimedAt: string;
  body: { [key: string]: Json };
}

/** 中繼的時間見證：簽署「我在 at 這個時間看到了這筆事件」 */
export interface Witness {
  relay: string;
  relayKey: string;
  at: string;
  sig: string;
}

export interface SignedEvent extends UnsignedEvent {
  sig: string;
  witness?: Witness;
}

function unsignedPart(e: UnsignedEvent | SignedEvent): UnsignedEvent {
  // 只取規格內的欄位，避免多出的欄位混進簽章範圍或被忽略
  const { v, type, subject, actor, actorKey, asRole, policy, prev, claimedAt, body } = e;
  return { v, type, subject, actor, actorKey, asRole, policy, prev, claimedAt, body };
}

/** event:sha256:… 以未簽章部分的 JCS 計算，簽章與見證不影響 id */
export function eventId(e: UnsignedEvent | SignedEvent): string {
  return `event:${sha256Id(utf8ToBytes(canonicalize(unsignedPart(e))))}`;
}

export function signEvent(e: Omit<UnsignedEvent, 'v' | 'actorKey'>, key: KeyPair): SignedEvent {
  const unsigned: UnsignedEvent = unsignedPart({ ...e, v: PROTOCOL_VERSION, actorKey: key.id });
  return { ...unsigned, sig: signText(EVENT_DOMAIN, canonicalize(unsigned), key) };
}

export function verifyEventSignature(e: SignedEvent): boolean {
  return verifyText(EVENT_DOMAIN, canonicalize(unsignedPart(e)), e.sig, e.actorKey);
}

export function witnessEvent(e: SignedEvent, relay: string, key: KeyPair, at: string): SignedEvent {
  const payload = canonicalize({ event: eventId(e), relay, at });
  return { ...e, witness: { relay, relayKey: key.id, at, sig: signText(WITNESS_DOMAIN, payload, key) } };
}

export function verifyWitness(e: SignedEvent): boolean {
  const w = e.witness;
  if (!w) return false;
  return verifyText(WITNESS_DOMAIN, canonicalize({ event: eventId(e), relay: w.relay, at: w.at }), w.sig, w.relayKey);
}

/** 排序與期限計算用的時間：有見證用見證時間，否則用自報時間 */
export function effectiveTime(e: SignedEvent): string {
  return e.witness?.at ?? e.claimedAt;
}
