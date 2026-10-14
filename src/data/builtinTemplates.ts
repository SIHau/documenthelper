import { emptyDocument, newAmendmentRow, newBudgetItem, newItem, newMinutesCase } from '../model/defaults';
import type { DocType, OfficialDocument } from '../model/types';

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  build: () => OfficialDocument;
}

const COUNCIL = '○○學生議會';
const sign = (title: string, name = '○○○') => ({ enabled: true, title, name, font: 'yuji-boku' as const });

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
          agenda: '',
          onLeave: '',
          absent: '',
          recorder: '',
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
        measures: [newItem(0, '○○○。')],
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
  {
    id: 'builtin:council-letter',
    name: '學生議會：議會函文（議字）',
    description: '以議會名義發函，議長署名',
    build: () =>
      make('函', {
        sender: { name: COUNCIL },
        recipient: { name: '○○○' },
        subject: '○○○，請查照。',
        explanation: [newItem(0, '○○○。')],
        signature: sign('議長'),
      }),
  },
  {
    id: 'builtin:speaker-order',
    name: '學生議會：議長令（議令）',
    description: '議長令，含受文者、主旨與說明',
    build: () =>
      make('令', {
        sender: { name: '學生議會議長' },
        recipient: { name: '○○○' },
        subject: '○○○。',
        explanation: [newItem(0, '○○○。')],
        signature: sign('議長'),
      }),
  },
  {
    id: 'builtin:speaker-order-plain',
    name: '學生議會：議長令（本文）',
    description: '議長令，不分主旨說明，直接書寫本文',
    build: () =>
      make('令', {
        sender: { name: '學生議會議長' },
        explanation: [newItem(0, '○○○。')],
        signature: sign('議長'),
      }),
  },
  {
    id: 'builtin:appointment',
    name: '學生議會：秘書長任命書',
    description: '議長任命秘書長，議令字',
    build: () =>
      make('令', {
        sender: { name: '學生議會議長' },
        explanation: [newItem(0, '茲任命○○○為第○屆學生議會秘書長。')],
        signature: sign('議長'),
      }),
  },
  {
    id: 'builtin:secretary-letter',
    name: '學生議會：議會秘書長函文（議秘）',
    description: '以秘書長名義發函',
    build: () =>
      make('函', {
        sender: { name: `${COUNCIL}秘書長` },
        recipient: { name: '○○○' },
        subject: '○○○，請查照。',
        explanation: [newItem(0, '○○○。')],
        signature: sign('秘書長'),
      }),
  },
  {
    id: 'builtin:council-announce',
    name: '學生議會：議會公告（議佈）',
    description: '主旨、依據、說明',
    build: () =>
      make('公告', {
        sender: { name: COUNCIL },
        subject: '公告○○○。',
        explanation: [newItem(0, '○○○。')],
        measures: [newItem(0, '○○○。')],
        signature: { ...sign('議長'), enabled: false },
      }),
  },
  {
    id: 'builtin:council-meeting',
    name: '學生議會：開會通知單（議通）',
    description: '開會通知與第二頁議程（報告事項、討論事項）',
    build: () =>
      make('開會通知單', {
        sender: { name: COUNCIL },
        recipient: { name: '如出席者' },
        urgency: '',
        attachments: '無',
        meeting: {
          reason: '第○屆學生議會○○委員會第○次會議',
          time: '中華民國○年○月○日（星期○）○時○分',
          place: '○○○',
          chair: '○○○',
          contact: '○○○',
          attendees: '○○○',
          observers: '',
          remarks: '本次會議不列印紙本資料，請與會人員留意。\n自此通知送達起至開會當日○時○分辦理質詢登記相關事宜，其餘時段恕不接受任何形式之登記。',
          agenda: '第○屆學生議會\n○○委員會第○次會議',
          onLeave: '',
          absent: '',
          recorder: '',
        },
        explanation: [newItem(0, '○○○。')],
        measures: [newItem(0, '○○○。')],
        signature: sign(COUNCIL, ''),
      }),
  },
  {
    id: 'builtin:council-urge',
    name: '學生議會：催辦案件通知單（議件）',
    description: '催辦未依期限辦理的案件',
    build: () =>
      make('催辦案件通知單', {
        sender: { name: COUNCIL },
        recipient: { name: '○○○　君' },
        subject: '有關○○○一案，請於○年○月○日前辦理見復。',
        signature: sign(COUNCIL, ''),
      }),
  },
  {
    id: 'builtin:council-review',
    name: '學生議會：審查報告對照表',
    description: '審查會通過條文、各提案、現行條文與說明併列',
    build: () =>
      make('審查報告對照表', {
        motion: {
          ...emptyDocument().motion,
          draftTitle: `${COUNCIL}議事規則部分條文修正草案`,
          reviewer: '○○委員會',
          proposalNames: ['○○○等三人', '○○黨團'],
          rows: [{ ...newAmendmentRow(), amended: '第○條　○○○。', proposals: ['第○條　○○○。', ''], current: '第○條　○○○。', reason: '一、○○○。' }],
        },
      }),
  },
  {
    id: 'builtin:council-correction',
    name: '學生議會：糾正案',
    description: '被糾正機關、案由、事實與理由，文末提案議員',
    build: () =>
      make('糾正案', {
        recipient: { name: '○○○' },
        subject: '○○○，爰依法提案糾正。',
        explanation: [newItem(0, '○○○。')],
        motion: { ...emptyDocument().motion, proposer: '○○○' },
      }),
  },
  {
    id: 'builtin:council-minutes',
    name: '學生議會：會議紀錄',
    description: '常會或臨時會會議紀錄，討論事項逐案記載決議',
    build: () =>
      make('會議紀錄', {
        sender: { name: '○○高級中學學生聯合自治會' },
        meeting: {
          ...emptyDocument().meeting,
          reason: '學生議會第○屆第○次常會',
          time: '中華民國○年○月○日（星期○）',
          place: '○○○',
          chair: '○○○',
          attendees: '○○○',
          recorder: '○○○',
        },
        minutes: {
          opening: '○○:○○',
          speech: '',
          agendaNote: '',
          cases: [{ ...newMinutesCase(), proposer: '○○○', subject: '○○○，提請審議。', explanation: '○○○。', resolution: '照案通過。' }],
          extempore: '',
        },
      }),
  },
  {
    id: 'builtin:council-signin',
    name: '學生議會：會議簽到表',
    description: '應到人員姓名在上、簽名格在下，另有列席與旁聽欄',
    build: () =>
      make('簽到表', {
        sender: { name: COUNCIL },
        meeting: { ...emptyDocument().meeting, reason: '第○屆第○次常會', time: '中華民國○年○月○日' },
      }),
  },
  {
    id: 'builtin:council-budget',
    name: '學生議會：概算書',
    description: '封面、目次、總說明與概算表（自動合計）',
    build: () =>
      make('概算書', {
        sender: { name: COUNCIL },
        budget: {
          year: '○',
          period: '○年○月○日至○年○月○日',
          editor: '○○高中第○屆學生議會',
          duties: '○○○。',
          divisions: '○○○。',
          purpose: '○○○。',
          tableTitle: '○學年度第○學期○○高中學生議會第○屆預算案',
          items: [
            { ...newBudgetItem('秘書處'), name: '影印費', code: '○', amount: '0', note: '簽到表、公告等文件印製。' },
            { ...newBudgetItem('秘書處'), name: '文具', code: '○', amount: '0', note: '資料夾、釘書機等。' },
          ],
        },
      }),
  },
  {
    id: 'builtin:motion-members',
    name: '議案關係文書：議員提案（修正草案）',
    description: '三人以上議員提案，附修正條文對照表',
    build: () =>
      make('議案關係文書', {
        subject: '本會議員○○○等三人，鑒於○○○，擬具「○○○」修正草案，是否有當？敬請公決。',
        explanation: [newItem(0, '○○○。'), newItem(0, '○○○。')],
        motion: {
          ...emptyDocument().motion,
          term: '○',
          proposer: '○○○',
          cosigners: '○○○ ○○○',
          draftTitle: '○○○修正草案',
          mode: '修正',
          rows: [{ ...newAmendmentRow(), amended: '第○條　○○○。', current: '第○條　○○○。', reason: '一、○○○。' }],
        },
      }),
  },
  {
    id: 'builtin:motion-caucus',
    name: '議案關係文書：黨團提案（新訂草案）',
    description: '黨團提案，附新訂條文與說明',
    build: () =>
      make('議案關係文書', {
        subject: '本會○○黨團鑒於○○○，擬具「○○○」草案，是否有當？敬請公決。',
        explanation: [newItem(0, '依《○○○》第○條擬定之。')],
        motion: {
          ...emptyDocument().motion,
          term: '○',
          proposer: '○○黨團',
          cosigners: '',
          draftTitle: '○○○草案',
          mode: '新訂',
          rows: [{ ...newAmendmentRow(), amended: '第一條　○○○。', reason: '一、○○○。' }],
        },
      }),
  },
];
