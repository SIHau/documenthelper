import { emptyDocument, newItem } from '../model/defaults';
import type { DocType, OfficialDocument } from '../model/types';

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  build: () => OfficialDocument;
}

function make(type: DocType, patch: Partial<OfficialDocument>): OfficialDocument {
  return { ...emptyDocument(type), ...patch };
}

/** 內建範本：內容以「○」標示待填處，檢查頁籤會提醒尚未填寫 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin:send',
    name: '函：檢送資料',
    description: '檢送文件或資料給對方，請其查照',
    build: () =>
      make('函', {
        subject: '檢送○○○一案，請查照。',
        explanation: [newItem(0, '依據貴單位○年○月○日○○字第○○○號函辦理。'), newItem(0, '檢附○○○一份，請查收。')],
        attachments: '○○○一份',
      }),
  },
  {
    id: 'builtin:reply',
    name: '函：函復',
    description: '回復來函詢問的事項',
    build: () =>
      make('函', {
        subject: '有關貴單位○年○月○日○○字第○○○號函詢○○○一案，復如說明，請查照。',
        explanation: [newItem(0, '復貴單位○年○月○日○○字第○○○號函。'), newItem(0, '有關○○○一節，說明如下：'), newItem(1, '○○○。')],
      }),
  },
  {
    id: 'builtin:request',
    name: '函：請求協助（平行）',
    description: '函請其他單位協助辦理',
    build: () =>
      make('函', {
        subject: '函請貴單位協助○○○一案，請查照惠復。',
        explanation: [newItem(0, '為辦理○○○，需貴單位協助提供○○○。'), newItem(0, '請於○年○月○日前回復，如有疑義，請洽承辦人。')],
      }),
  },
  {
    id: 'builtin:meeting',
    name: '開會通知單',
    description: '召開會議的通知',
    build: () =>
      make('開會通知單', {
        meeting: {
          reason: '○○○會議',
          time: '○年○月○日（星期○）上午○時○分',
          place: '○○○',
          chair: '○○○',
          contact: '○○○（電話：○○○）',
          attendees: '○○○',
          observers: '',
          remarks: '',
        },
      }),
  },
  {
    id: 'builtin:announce',
    name: '公告：一般公告',
    description: '對外公告事項',
    build: () =>
      make('公告', {
        subject: '公告○○○。',
        explanation: [newItem(0, '依○○○法第○條規定辦理。')],
        measures: [newItem(0, '○○○。'), newItem(0, '特此公告。')],
      }),
  },
  {
    id: 'builtin:memo',
    name: '簽：簽請核示',
    description: '對上級簽請核示',
    build: () =>
      make('簽', {
        direction: '上行',
        subject: '為辦理○○○，簽請核示。',
        explanation: [newItem(0, '依據○○○辦理。'), newItem(0, '○○○。')],
        measures: [newItem(0, '擬准所請，奉核後辦理。')],
      }),
  },
];
