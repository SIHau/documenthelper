import { EVENT_TYPES, PROTOCOL_VERSION, effectiveTime, eventId, verifyEventSignature, verifyWitness } from './event';
import type { EventType, SignedEvent } from './event';

export type DocState =
  | 'sent'
  | 'delivered'
  | 'received'
  | 'assigned'
  | 'processing'
  | 'replied'
  | 'closed'
  | 'withdrawn'
  | 'returned';

export const STATE_LABELS: Record<DocState, string> = {
  sent: '已發文',
  delivered: '已送達',
  received: '已正式收文',
  assigned: '已分派承辦',
  processing: '處理中',
  replied: '已回覆',
  closed: '結案',
  withdrawn: '已撤回',
  returned: '已退文',
};

export const EVENT_LABELS: Record<EventType, string> = {
  'doc.sent': '發文',
  'doc.delivered': '送達',
  'doc.received': '收文',
  'doc.assigned': '分派',
  'doc.progress': '處理進度',
  'doc.replied': '回覆',
  'doc.closed': '結案',
  'doc.withdrawn': '撤回',
  'doc.returned': '退文',
};

interface Rule {
  from: DocState[];
  to: DocState;
  /** 只能由發文方（發文事件的行為人）或只能由收文方做 */
  by?: 'sender' | 'recipient';
  check?: (e: SignedEvent) => string | null;
}

const text = (e: SignedEvent, key: string) => {
  const v = e.body[key];
  return typeof v === 'string' ? v.trim() : '';
};

/** 狀態只會往前走；撤回與退文是支線 */
const RULES: Record<Exclude<EventType, 'doc.sent'>, Rule> = {
  'doc.delivered': { from: ['sent'], to: 'delivered', by: 'recipient' },
  'doc.received': { from: ['sent', 'delivered'], to: 'received', by: 'recipient' },
  'doc.assigned': {
    from: ['received', 'assigned'],
    to: 'assigned',
    by: 'recipient',
    check: (e) => (text(e, 'assignee') ? null : '分派事件必須寫明承辦人（body.assignee）'),
  },
  'doc.progress': { from: ['received', 'assigned', 'processing'], to: 'processing', by: 'recipient' },
  'doc.replied': {
    from: ['received', 'assigned', 'processing'],
    to: 'replied',
    by: 'recipient',
    check: (e) => (/^doc:sha256:[0-9a-f]{64}$/.test(text(e, 'reply')) ? null : '回覆事件必須引用回覆公文的 id（body.reply）'),
  },
  'doc.closed': { from: ['replied'], to: 'closed', by: 'sender' },
  'doc.withdrawn': { from: ['sent', 'delivered'], to: 'withdrawn', by: 'sender' },
  'doc.returned': {
    from: ['sent', 'delivered', 'received'],
    to: 'returned',
    by: 'recipient',
    check: (e) => (text(e, 'reason') ? null : '退文必須附理由（body.reason）'),
  },
};

export interface EventCheck {
  id: string;
  event: SignedEvent;
  valid: boolean;
  /** 無效的原因 */
  problem?: string;
  /** 有效但沒有改變狀態（例：收文後才到的送達 Receipt） */
  noEffect?: boolean;
}

export interface Derivation {
  /** null：找不到有效的發文事件 */
  state: DocState | null;
  /** 發文者（發文事件的行為人與金鑰） */
  sender?: { actor: string; key: string };
  /** 依處理順序排列 */
  events: EventCheck[];
  delivered?: SignedEvent;
  received?: SignedEvent;
}

function basicProblem(e: SignedEvent, docId: string): string | null {
  if (e.v !== PROTOCOL_VERSION) return `不支援的協定版本 ${e.v}`;
  if (!(EVENT_TYPES as readonly string[]).includes(e.type)) return `未知的事件類型 ${e.type}`;
  if (e.subject !== docId) return '事件指向另一份文件';
  if (!verifyEventSignature(e)) return '簽章無效';
  if (e.witness && !verifyWitness(e)) return '中繼見證簽章無效';
  return null;
}

/**
 * 從事件推導公文狀態。任何裝置拿到同一組事件都會算出同樣的結果：
 * 先依 prev 做拓撲排序（同層以見證時間、再以 id 排序），再逐筆套用狀態規則。
 */
export function deriveState(docId: string, events: SignedEvent[]): Derivation {
  const byId = new Map<string, SignedEvent>();
  for (const e of events) byId.set(eventId(e), e);

  const checks = new Map<string, EventCheck>();
  for (const [id, e] of byId) {
    const problem = basicProblem(e, docId) ?? (e.prev.find((p) => !byId.has(p)) ? '缺少前一筆事件（prev）' : null);
    checks.set(id, { id, event: e, valid: !problem, problem: problem ?? undefined });
  }

  // 拓撲排序
  const order: string[] = [];
  const done = new Set<string>();
  const pending = new Set(byId.keys());
  while (pending.size) {
    const ready = [...pending].filter((id) => byId.get(id)!.prev.every((p) => done.has(p) || !byId.has(p)));
    if (!ready.length) break; // 依 hash 鏈結理論上不會有循環
    ready.sort((a, b) => {
      // 時間可能帶不同時區，換成毫秒再比較；無法解析的排最後
      const ta = Date.parse(effectiveTime(byId.get(a)!)) || Infinity;
      const tb = Date.parse(effectiveTime(byId.get(b)!)) || Infinity;
      return ta < tb ? -1 : ta > tb ? 1 : a < b ? -1 : 1;
    });
    const id = ready[0];
    order.push(id);
    done.add(id);
    pending.delete(id);
  }

  const result: Derivation = { state: null, events: [] };
  for (const id of order) {
    const c = checks.get(id)!;
    const e = c.event;
    const fail = (problem: string) => Object.assign(c, { valid: false, problem });
    result.events.push(c);
    if (!c.valid) continue;
    if (e.prev.some((p) => !checks.get(p)!.valid)) {
      fail('前一筆事件無效');
      continue;
    }
    if (e.type === 'doc.sent') {
      if (result.sender) fail('同一份文件只能有一筆發文事件');
      else if (e.prev.length) fail('發文事件不能有 prev');
      else {
        result.sender = { actor: e.actor, key: e.actorKey };
        result.state = 'sent';
      }
      continue;
    }
    if (!result.sender || !result.state) {
      fail('在發文事件之前');
      continue;
    }
    const rule = RULES[e.type];
    const isSender = e.actor === result.sender.actor;
    if (rule.by === 'sender' && !isSender) {
      fail('只有發文方可以做這件事');
      continue;
    }
    if (rule.by === 'recipient' && isSender) {
      fail('發文方不能替收文方做這件事');
      continue;
    }
    const bodyProblem = rule.check?.(e);
    if (bodyProblem) {
      fail(bodyProblem);
      continue;
    }
    if (e.type === 'doc.delivered') {
      result.delivered ??= e;
      if (result.state !== 'sent') c.noEffect = true;
      else result.state = 'delivered';
      continue;
    }
    if (!rule.from.includes(result.state)) {
      fail(`目前狀態是「${STATE_LABELS[result.state]}」，不能${EVENT_LABELS[e.type]}`);
      continue;
    }
    if (e.type === 'doc.received') result.received = e;
    result.state = rule.to;
  }
  return result;
}
