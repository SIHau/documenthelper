import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { canonicalize } from './jcs';
import { generateKeyPair, signText, verifyText } from './keys';
import { eventId, signEvent, verifyEventSignature, verifyWitness, witnessEvent } from './event';
import type { SignedEvent } from './event';
import { appendEvent, createPackage, mergeEvents, readPackage, verifyPackage, writePackage } from './package';
import type { DocumentPackage } from './package';
import { deriveState } from './state';
import { packageDocument } from './fromDocument';
import { emptyDocument, newItem } from '../model/defaults';

const sender = generateKeyPair();
const clerk = generateKeyPair();
const relay = generateKeyPair();

function newPackage(): DocumentPackage {
  return createPackage(
    {
      docType: '函',
      title: '檢送會議紀錄，請查照。',
      docNumber: '議字第1151014001號',
      from: { name: '學生議會' },
      to: [{ name: '學生會' }],
      files: [
        { path: 'content.json', role: 'content', mediaType: 'application/json', bytes: strToU8('{"subject":"檢送會議紀錄"}') },
        { path: 'document.pdf', role: 'rendering', mediaType: 'application/pdf', bytes: strToU8('%PDF-1.7 fake') },
        { path: 'attachments/紀錄.pdf', role: 'attachment', mediaType: 'application/pdf', bytes: strToU8('%PDF att') },
      ],
      generator: { name: 'documenthelper', version: '0.1.0' },
      actor: 'person:google:speaker',
      asRole: 'organ:council/speaker',
      now: '2026-10-14T09:00:00+08:00',
    },
    sender,
  );
}

/** 中繼送達 Receipt（含見證）＋收文承辦人簽收 */
function deliverAndReceive(pkg: DocumentPackage): DocumentPackage {
  const witnessedSent = witnessEvent(pkg.events[0], 'relay:studentgov', relay, '2026-10-14T01:00:05Z');
  let p = mergeEvents(pkg, [witnessedSent]);
  p = appendEvent(p, { type: 'doc.delivered', actor: 'relay:studentgov', claimedAt: '2026-10-14T01:00:06Z', body: { to: '學生會' } }, relay);
  return appendEvent(
    p,
    { type: 'doc.received', actor: 'person:google:clerk', asRole: 'organ:student-council/clerk', claimedAt: '2026-10-14T03:00:00Z', body: { receiptNumber: '會收字第1151014003號' } },
    clerk,
  );
}

describe('JCS（RFC 8785）', () => {
  it('matches the RFC example', () => {
    const input = JSON.parse('{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/","literals":[null,true,false]}');
    expect(canonicalize(input)).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}');
  });
  it('sorts keys by UTF-16 code units and rejects non-JSON values', () => {
    expect(canonicalize({ b: 1, a: { d: [1, 'x'], c: null }, 中: true, A: undefined })).toBe('{"a":{"c":null,"d":[1,"x"]},"b":1,"中":true}');
    expect(() => canonicalize({ x: NaN })).toThrow();
    expect(() => canonicalize(new Date())).toThrow();
  });
});

describe('簽章', () => {
  it('verifies, rejects tampering and separates purposes', () => {
    const sig = signText('studentgov/event/v1', 'hello', sender);
    expect(verifyText('studentgov/event/v1', 'hello', sig, sender.id)).toBe(true);
    expect(verifyText('studentgov/event/v1', 'hello!', sig, sender.id)).toBe(false);
    expect(verifyText('studentgov/witness/v1', 'hello', sig, sender.id)).toBe(false);
    expect(verifyText('studentgov/event/v1', 'hello', sig, clerk.id)).toBe(false);
  });
  it('keeps event ids stable when a witness is added', () => {
    const e = newPackage().events[0];
    const w = witnessEvent(e, 'relay:studentgov', relay, '2026-10-14T01:00:05Z');
    expect(eventId(w)).toBe(eventId(e));
    expect(verifyEventSignature(w)).toBe(true);
    expect(verifyWitness(w)).toBe(true);
    expect(verifyWitness({ ...w, witness: { ...w.witness!, at: '2026-10-13T00:00:00Z' } })).toBe(false);
    expect(verifyEventSignature({ ...e, claimedAt: '2026-10-15T00:00:00Z' })).toBe(false);
  });
});

describe('文件包', () => {
  it('round-trips through a zip and passes all three checks once received', () => {
    const pkg = newPackage();
    const sentOnly = verifyPackage(readPackage(writePackage(pkg)));
    expect(sentOnly.integrity.ok).toBe(true);
    expect(sentOnly.source).toMatchObject({ ok: true, actor: 'person:google:speaker', key: sender.id });
    expect(sentOnly.delivery).toMatchObject({ ok: false, state: 'sent', stateLabel: '已發文' });

    const bytes = writePackage(deliverAndReceive(pkg));
    expect(writePackage(readPackage(bytes))).toEqual(bytes);
    const r = verifyPackage(readPackage(bytes));
    expect(r.docId).toBe(pkg.docId);
    expect(r.integrity.ok && r.source.ok && r.delivery.ok).toBe(true);
    expect(r.source.at).toBe('2026-10-14T01:00:05Z');
    expect(r.delivery).toMatchObject({
      state: 'received',
      delivered: { actor: 'relay:studentgov' },
      received: { actor: 'person:google:clerk', receiptNumber: '會收字第1151014003號' },
    });
    expect(r.events.map((e) => e.label)).toEqual(['發文', '送達', '收文']);
  });

  it('detects a modified PDF, an extra file and a modified manifest', () => {
    const pkg = deliverAndReceive(newPackage());
    const files = new Map(pkg.files);
    files.set('document.pdf', strToU8('%PDF-1.7 forged'));
    files.set('extra.txt', strToU8('x'));
    const r = verifyPackage({ ...pkg, files });
    expect(r.integrity.ok).toBe(false);
    expect(r.integrity.problems).toEqual(['檔案 document.pdf 與清單不符（可能被修改過）', '清單沒有列出的檔案 extra.txt']);
    expect(r.source.ok).toBe(true);

    // 改清單（例如主旨）會讓文件 id 改變，原本的發文簽章就不再屬於這份文件
    const forged = readPackage(writePackage({ ...pkg, manifest: { ...pkg.manifest, title: '偽造的主旨' } }));
    const f = verifyPackage(forged);
    expect(f.docId).not.toBe(pkg.docId);
    expect(f.source.ok).toBe(false);
    expect(f.events.every((e) => !e.valid && e.problem === '事件指向另一份文件')).toBe(true);
  });

  it('packages an OfficialDocument with its PDF', () => {
    const doc = { ...emptyDocument('函'), subject: '請查照。', docNumber: '議字第1151014002號' };
    doc.sender = { name: '學生議會', code: 'SC01' };
    doc.recipient = { name: '學生會' };
    doc.primaryRecipients = '學生會、選舉委員會';
    doc.explanation = [newItem(0, '說明。')];
    const pkg = packageDocument(doc, strToU8('%PDF'), { key: sender, actor: 'person:google:speaker', now: '2026-10-14T09:00:00+08:00', generatorVersion: '0.1.0' });
    expect(pkg.manifest).toMatchObject({
      docType: '函',
      title: '請查照。',
      docNumber: '議字第1151014002號',
      from: { name: '學生議會', code: 'SC01' },
      to: [{ name: '學生會' }, { name: '選舉委員會' }],
      generator: { name: 'documenthelper', version: '0.1.0' },
    });
    expect(pkg.manifest.files.map((f) => f.path)).toEqual(['content.json', 'document.pdf']);
    expect(verifyPackage(pkg).integrity.ok).toBe(true);
  });
});

describe('狀態推導', () => {
  const states = (pkg: DocumentPackage) => {
    const d = deriveState(pkg.docId, pkg.events);
    return { state: d.state, problems: d.events.filter((e) => !e.valid).map((e) => `${e.event.type}: ${e.problem}`) };
  };
  const add = (pkg: DocumentPackage, type: SignedEvent['type'], who: 'sender' | 'clerk', body = {}) =>
    appendEvent(
      pkg,
      { type, actor: who === 'sender' ? 'person:google:speaker' : 'person:google:clerk', claimedAt: '2026-10-14T05:00:00Z', body },
      who === 'sender' ? sender : clerk,
    );

  it('walks the main path to 結案', () => {
    let p = deliverAndReceive(newPackage());
    p = add(p, 'doc.assigned', 'clerk', { assignee: '王小明' });
    p = add(p, 'doc.progress', 'clerk', { note: '研議中' });
    p = add(p, 'doc.replied', 'clerk', { reply: `doc:sha256:${'a'.repeat(64)}` });
    p = add(p, 'doc.closed', 'sender');
    expect(states(p)).toEqual({ state: 'closed', problems: [] });
  });

  it('enforces who may act and in which state', () => {
    const received = deliverAndReceive(newPackage());
    expect(states(add(received, 'doc.withdrawn', 'sender')).problems).toEqual(['doc.withdrawn: 目前狀態是「已正式收文」，不能撤回']);
    expect(states(add(newPackage(), 'doc.withdrawn', 'sender')).state).toBe('withdrawn');
    expect(states(add(newPackage(), 'doc.received', 'sender')).problems).toEqual(['doc.received: 發文方不能替收文方做這件事']);
    expect(states(add(newPackage(), 'doc.returned', 'clerk')).problems).toEqual(['doc.returned: 退文必須附理由（body.reason）']);
    expect(states(add(newPackage(), 'doc.returned', 'clerk', { reason: '非本機關權責' })).state).toBe('returned');
    expect(states(add(received, 'doc.assigned', 'clerk')).problems).toEqual(['doc.assigned: 分派事件必須寫明承辦人（body.assignee）']);
    expect(states(add(received, 'doc.closed', 'clerk')).problems).toEqual(['doc.closed: 只有發文方可以做這件事']);
  });

  it('flags missing history, duplicate sends and forged events', () => {
    const pkg = deliverAndReceive(newPackage());
    const received = pkg.events[pkg.events.length - 1];
    // 只拿到收文 Receipt、沒有前面的事件
    expect(deriveState(pkg.docId, [received]).events[0].problem).toBe('缺少前一筆事件（prev）');
    const second = signEvent({ type: 'doc.sent', subject: pkg.docId, actor: 'person:google:other', prev: [], claimedAt: '2026-10-14T00:00:00Z', body: {} }, clerk);
    expect(states({ ...pkg, events: [...pkg.events, second] }).problems).toContain('doc.sent: 同一份文件只能有一筆發文事件');
    const forged = { ...received, body: { receiptNumber: '改過的文號' } };
    expect(states({ ...pkg, events: [...pkg.events.slice(0, -1), forged] }).problems).toEqual(['doc.received: 簽章無效']);
  });

  it('accepts a late delivery receipt without moving the state back', () => {
    let p = newPackage();
    p = add(p, 'doc.received', 'clerk');
    p = appendEvent(p, { type: 'doc.delivered', actor: 'relay:studentgov', claimedAt: '2026-10-14T06:00:00Z' }, relay);
    const d = deriveState(p.docId, p.events);
    expect(d.state).toBe('received');
    expect(d.events.find((e) => e.event.type === 'doc.delivered')).toMatchObject({ valid: true, noEffect: true });
  });

  it('derives the same result whatever order the events arrive in', () => {
    const p = deliverAndReceive(newPackage());
    const forward = deriveState(p.docId, p.events);
    const backward = deriveState(p.docId, [...p.events].reverse());
    expect(backward.state).toBe(forward.state);
    expect(backward.events.map((e) => e.id)).toEqual(forward.events.map((e) => e.id));
  });
});
