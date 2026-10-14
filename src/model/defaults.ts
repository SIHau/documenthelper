import type { AmendmentRow, MinutesCase, OfficialDocument, OutlineItem } from './types';
import { todayIso } from './date';

let seq = 0;
export function newId(): string {
  seq += 1;
  return `i${Date.now().toString(36)}${seq}`;
}

export function newItem(level = 0, text = ''): OutlineItem {
  return { id: newId(), level, text };
}

export function newAmendmentRow(): AmendmentRow {
  return { id: newId(), amended: '', current: '', reason: '', proposals: [] };
}

export function newMinutesCase(): MinutesCase {
  return { id: newId(), proposer: '', subject: '', explanation: '', resolution: '' };
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
    archive: { fileNo: '', retention: '' },
    meeting: { reason: '', time: '', place: '', chair: '', contact: '', attendees: '', observers: '', remarks: '', agenda: '', onLeave: '', absent: '', recorder: '' },
    motion: { term: '', proposer: '', cosigners: '', draftTitle: '', mode: '修正', rows: [newAmendmentRow()], reviewer: '', proposalNames: [] },
    minutes: { opening: '', speech: '', agendaNote: '', cases: [newMinutesCase()], extempore: '' },
  };
}
