import type { OfficialDocument, OutlineItem } from './types';
import { todayIso } from './date';

let seq = 0;
export function newId(): string {
  seq += 1;
  return `i${Date.now().toString(36)}${seq}`;
}

export function newItem(level = 0, text = ''): OutlineItem {
  return { id: newId(), level, text };
}

export function emptyDocument(type: OfficialDocument['type'] = '函'): OfficialDocument {
  return {
    type,
    direction: '平行',
    sender: { name: '' },
    senderAddress: '',
    contact: { person: '', phone: '', email: '', fax: '' },
    recipient: { name: '' },
    date: todayIso(),
    docNumber: '',
    urgency: '普通件',
    secrecy: '',
    attachments: '',
    subject: '',
    explanation: [newItem()],
    measures: [],
    primaryRecipients: '',
    ccRecipients: '',
    signature: { enabled: true, title: '', name: '', font: 'yuji-boku' },
    meeting: { reason: '', time: '', place: '', chair: '', contact: '', attendees: '', observers: '', remarks: '' },
  };
}
