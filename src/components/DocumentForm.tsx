import type { ReactNode } from 'react';
import type { Direction, DocType, DraftMode, OfficialDocument, Secrecy, SignatureFont, Urgency } from '../model/types';
import { DOC_TYPES, DOC_TYPE_LIST } from '../model/docTypes';
import type { Agency } from '../db/types';
import { AgencyPicker } from './AgencyPicker';
import { OutlineEditor } from './OutlineEditor';
import { DraftTableEditor } from './DraftTableEditor';
import { MinutesCaseEditor } from './MinutesCaseEditor';
import { confirmDialog } from '../dialogs';
import { COUNCIL_WORDS, defaultWord, nextDocNumber } from '../model/docNumber';

interface Props {
  doc: OfficialDocument;
  agencies: Agency[];
  onChange: (doc: OfficialDocument) => void;
  onReset: () => void;
  /** 已存稿件的發文字號，用來推算當日流水號 */
  usedNumbers: string[];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

const MEETING_FIELDS: Array<[keyof OfficialDocument['meeting'], string, boolean]> = [
  ['reason', '開會事由', false],
  ['time', '開會時間', false],
  ['place', '開會地點', false],
  ['chair', '主持人', false],
  ['contact', '聯絡人及電話', false],
  ['attendees', '出席者', true],
  ['observers', '列席者', true],
  ['remarks', '備註（每行一點）', true],
  ['agenda', '議程標題（每行一列，另起一頁；可留空）', true],
];

type MeetingKey = keyof OfficialDocument['meeting'];
/** 會議紀錄與簽到表使用的開會資訊欄位：[欄位, 標題, 多行] */
const RECORD_FIELDS: Record<'minutes' | 'signin', Array<[MeetingKey, string, boolean]>> = {
  minutes: [
    ['reason', '會議名稱（標題第二行，例：學生議會第十五屆第一次常會）', false],
    ['time', '時間', false],
    ['place', '地點', false],
    ['chair', '主席', false],
    ['attendees', '出席者', true],
    ['onLeave', '請假者', true],
    ['absent', '缺席者', true],
    ['observers', '列席者', true],
    ['recorder', '記錄人員', false],
  ],
  signin: [
    ['reason', '會議名稱', false],
    ['time', '會議日期', false],
    ['attendees', '應到人員（以空白或頓號分隔，印在簽名格上方）', true],
    ['observers', '列席人員（可留空，現場手寫）', true],
  ],
};

export function DocumentForm({ doc, agencies, onChange, onReset, usedNumbers }: Props) {
  const findAgency = (name: string) => agencies.find((a) => a.name === name.trim());
  /** 發文機關：名稱完全符合通訊錄時，帶入代碼、地址與聯絡資料（只補空白欄位） */
  const changeSender = (name: string) => {
    const a = findAgency(name);
    onChange({
      ...doc,
      sender: { ...doc.sender, name, ...(a ? { code: a.code } : {}) },
      ...(a && !doc.senderAddress ? { senderAddress: a.address } : {}),
      ...(a ? { contact: { ...doc.contact, phone: doc.contact.phone || a.phone, fax: doc.contact.fax || a.fax, email: doc.contact.email || a.email } } : {}),
    });
  };
  const changeRecipient = (name: string) => {
    const a = findAgency(name);
    onChange({ ...doc, recipient: { ...doc.recipient, name, ...(a ? { code: a.code } : {}) } });
  };
  const cfg = DOC_TYPES[doc.type];
  const set = <K extends keyof OfficialDocument>(key: K, value: OfficialDocument[K]) =>
    onChange({ ...doc, [key]: value });
  const setContact = (key: keyof OfficialDocument['contact'], value: string) =>
    onChange({ ...doc, contact: { ...doc.contact, [key]: value } });
  const setMotion = <K extends keyof OfficialDocument['motion']>(key: K, value: OfficialDocument['motion'][K]) =>
    onChange({ ...doc, motion: { ...doc.motion, [key]: value } });
  const setMeeting = (key: keyof OfficialDocument['meeting'], value: string) =>
    onChange({ ...doc, meeting: { ...doc.meeting, [key]: value } });
  const setMinutes = <K extends keyof OfficialDocument['minutes']>(key: K, value: OfficialDocument['minutes'][K]) =>
    onChange({ ...doc, minutes: { ...doc.minutes, [key]: value } });
  const setArchive = (key: keyof OfficialDocument['archive'], value: string) =>
    onChange({ ...doc, archive: { ...doc.archive, [key]: value } });
  const docWord = /^(.+?字)第/.exec(doc.docNumber)?.[1] ?? defaultWord(doc.type, doc.sender.name);
  const setSignature = <K extends keyof OfficialDocument['signature']>(
    key: K,
    value: OfficialDocument['signature'][K],
  ) => onChange({ ...doc, signature: { ...doc.signature, [key]: value } });

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      <datalist id="agency-list">
        {agencies.map((a) => <option key={a.id} value={a.name} />)}
      </datalist>
      <div className="form-head">
        <h2>公文內容</h2>
        <button type="button" onClick={async () => (await confirmDialog('確定清除目前草稿？')) && onReset()}>
          清除草稿
        </button>
      </div>

      <fieldset>
        <legend>基本資料</legend>
        <div className="grid">
          <Field label="文種">
            <select value={doc.type} onChange={(e) => set('type', e.target.value as DocType)}>
              {DOC_TYPE_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {cfg.letterhead && (
            <Field label="行文方向">
              <select value={doc.direction} onChange={(e) => set('direction', e.target.value as Direction)}>
                <option>上行</option><option>平行</option><option>下行</option>
              </select>
            </Field>
          )}
          {cfg.motion && (
            <Field label="屆別（頁首：學生議會第○屆）">
              <input value={doc.motion.term} placeholder="例：十四"
                onChange={(e) => setMotion('term', e.target.value)} />
            </Field>
          )}
          {cfg.urgencySecrecy && (
            <>
              <Field label="速別">
                <select value={doc.urgency} onChange={(e) => set('urgency', e.target.value as Urgency)}>
                  <option value="">（不填）</option>
                  <option>普通件</option><option>速件</option><option>最速件</option>
                </select>
              </Field>
              <Field label="密等">
                <select value={doc.secrecy} onChange={(e) => set('secrecy', e.target.value as Secrecy)}>
                  <option value="">（不填）</option>
                  <option>密</option><option>機密</option><option>極機密</option><option>絕對機密</option>
                </select>
              </Field>
            </>
          )}
          {cfg.letterhead && (
            <Field label={cfg.dateLabel}>
              <input type="date" value={doc.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          )}
          {cfg.docNumber && (
            <Field label="發文字號">
              <span className="with-picker docnum">
                <input value={doc.docNumber} placeholder="例：議字第1151014001號"
                  onChange={(e) => set('docNumber', e.target.value)} />
                <select aria-label="字別" value={(COUNCIL_WORDS as readonly string[]).includes(docWord) ? docWord : ''}
                  onChange={(e) => e.target.value && set('docNumber', nextDocNumber(e.target.value, doc.date, usedNumbers))}>
                  <option value="">產生字號…</option>
                  {COUNCIL_WORDS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <button type="button" title="依字別、發文日期與當日已用字號產生下一號"
                  onClick={() => set('docNumber', nextDocNumber(docWord, doc.date, usedNumbers))}>
                  產生
                </button>
              </span>
            </Field>
          )}
          {cfg.filing && (
            <>
              <Field label="檔號（選填）">
                <input value={doc.archive.fileNo} onChange={(e) => setArchive('fileNo', e.target.value)} />
              </Field>
              <Field label="保存年限（選填）">
                <input value={doc.archive.retention} onChange={(e) => setArchive('retention', e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </fieldset>

      {cfg.letterhead && (
      <fieldset>
        <legend>機關與{cfg.recipient ? cfg.recipientLabel : '聯絡'}</legend>
        <div className="grid">
          <Field label="發文機關">
            <input value={doc.sender.name} list="agency-list"
              onChange={(e) => changeSender(e.target.value)} />
          </Field>
          <Field label="機關代碼（選填）">
            <input value={doc.sender.code ?? ''}
              onChange={(e) => set('sender', { ...doc.sender, code: e.target.value })} />
          </Field>
          <Field label="地址">
            <input value={doc.senderAddress} onChange={(e) => set('senderAddress', e.target.value)} />
          </Field>
          <Field label="承辦人">
            <input value={doc.contact.person}
              onChange={(e) => setContact('person', e.target.value)} />
          </Field>
          <Field label="連絡電話">
            <input type="tel" value={doc.contact.phone}
              onChange={(e) => setContact('phone', e.target.value)} />
          </Field>
          <Field label="電子郵件">
            <input type="email" value={doc.contact.email}
              onChange={(e) => setContact('email', e.target.value)} />
          </Field>
          <Field label="傳真">
            <input type="tel" value={doc.contact.fax}
              onChange={(e) => setContact('fax', e.target.value)} />
          </Field>
          {cfg.recipient && (
            <Field label={cfg.recipientRequired ? cfg.recipientLabel : `${cfg.recipientLabel}（可留空）`}>
              <input value={doc.recipient.name} list="agency-list"
                onChange={(e) => changeRecipient(e.target.value)} />
            </Field>
          )}
        </div>
      </fieldset>
      )}

      {cfg.meeting && (
        <fieldset>
          <legend>開會資訊</legend>
          {MEETING_FIELDS.map(([key, label, multi]) => (
            <Field key={key} label={label}>
              {multi ? (
                <textarea rows={2} value={doc.meeting[key]} onChange={(e) => setMeeting(key, e.target.value)} />
              ) : (
                <input value={doc.meeting[key]} onChange={(e) => setMeeting(key, e.target.value)} />
              )}
            </Field>
          ))}
        </fieldset>
      )}

      {!cfg.letterhead && (cfg.senderOnly || cfg.recipient) && (
        <fieldset>
          <legend>{cfg.senderOnly ? '機關' : cfg.recipientLabel}</legend>
          <div className="grid">
            {cfg.senderOnly && (
              <Field label="機關名稱（標題）">
                <input value={doc.sender.name} list="agency-list" placeholder="例：○○高級中學學生議會"
                  onChange={(e) => changeSender(e.target.value)} />
              </Field>
            )}
            {cfg.recipient && (
              <Field label={cfg.recipientLabel}>
                <input value={doc.recipient.name} list="agency-list"
                  onChange={(e) => changeRecipient(e.target.value)} />
              </Field>
            )}
          </div>
        </fieldset>
      )}

      {(cfg.layout === 'minutes' || cfg.layout === 'signin') && (
        <fieldset>
          <legend>會議資訊</legend>
          {RECORD_FIELDS[cfg.layout].map(([key, label, multi]) => (
            <Field key={key} label={label}>
              {multi ? (
                <textarea rows={2} value={doc.meeting[key]} onChange={(e) => setMeeting(key, e.target.value)} />
              ) : (
                <input value={doc.meeting[key]} onChange={(e) => setMeeting(key, e.target.value)} />
              )}
            </Field>
          ))}
        </fieldset>
      )}

      {cfg.layout === 'minutes' && (
        <fieldset>
          <legend>會議經過</legend>
          <Field label="壹、主席宣布開會（時刻，例：12:20）">
            <input value={doc.minutes.opening} onChange={(e) => setMinutes('opening', e.target.value)} />
          </Field>
          <Field label="貳、主席致詞（留空印「無。」）">
            <textarea rows={2} value={doc.minutes.speech} onChange={(e) => setMinutes('speech', e.target.value)} />
          </Field>
          <Field label="參、宣讀並確認本次會議議程（留空印「確認。」）">
            <input value={doc.minutes.agendaNote} onChange={(e) => setMinutes('agendaNote', e.target.value)} />
          </Field>
          <p className="hint">肆、討論事項</p>
          <MinutesCaseEditor cases={doc.minutes.cases} onChange={(v) => setMinutes('cases', v)} />
          <Field label="伍、臨時動議（留空印「無。」）">
            <textarea rows={2} value={doc.minutes.extempore} onChange={(e) => setMinutes('extempore', e.target.value)} />
          </Field>
        </fieldset>
      )}

      {cfg.subject && (
        <fieldset>
          <legend>{cfg.subjectLabel}{cfg.subjectRequired ? '' : '（可留空，本文直接寫在下方）'}</legend>
          <textarea rows={3} value={doc.subject}
            placeholder={cfg.motion ? '例：本會議員○○○等三人，鑒於…，擬具「○○○」修正草案，是否有當？敬請公決。' : '簡明扼要，一段完成，不分項'}
            onChange={(e) => set('subject', e.target.value.replace(/\n/g, ''))} />
        </fieldset>
      )}

      {cfg.explanationLabel && (
        <fieldset>
          <legend>{cfg.meeting ? `議程：${cfg.explanationLabel}（可留空）` : cfg.explanationLabel}</legend>
          <OutlineEditor items={doc.explanation} onChange={(v) => set('explanation', v)} />
        </fieldset>
      )}

      {cfg.measuresLabel && (
        <fieldset>
          <legend>{cfg.meeting ? '議程：' : ''}{cfg.measuresLabel}（可留空）</legend>
          <OutlineEditor items={doc.measures} onChange={(v) => set('measures', v)} />
        </fieldset>
      )}

      {cfg.proposers && (
          <fieldset>
            <legend>{cfg.motion ? '提案人與連署人' : '提案議員'}</legend>
            <div className="grid">
              <Field label="提案人">
                <input value={doc.motion.proposer} placeholder="議員姓名或黨團名稱"
                  onChange={(e) => setMotion('proposer', e.target.value)} />
              </Field>
              <Field label="連署人（黨團提案免填）">
                <input value={doc.motion.cosigners} placeholder="以空白或頓號分隔"
                  onChange={(e) => setMotion('cosigners', e.target.value)} />
              </Field>
            </div>
          </fieldset>
      )}

      {cfg.layout === 'review' && (
        <fieldset>
          <legend>審查報告對照表</legend>
          <div className="grid">
            <Field label="法規與草案名稱（標題第一行）">
              <input value={doc.motion.draftTitle} placeholder="例：○○學生議會議事規則部分條文修正草案"
                onChange={(e) => setMotion('draftTitle', e.target.value)} />
            </Field>
            <Field label="審查會">
              <input value={doc.motion.reviewer} placeholder="例：法制委員會"
                onChange={(e) => setMotion('reviewer', e.target.value)} />
            </Field>
            <Field label="併案審查的提案（以頓號分隔，每案一欄）">
              <input value={doc.motion.proposalNames.join('、')} placeholder="例：王小明等三人、○○黨團"
                onChange={(e) => setMotion('proposalNames', e.target.value.split(/[、，,]/).map((x) => x.trim()))} />
            </Field>
          </div>
          <DraftTableEditor mode="審查" rows={doc.motion.rows} reviewer={doc.motion.reviewer}
            proposalNames={doc.motion.proposalNames.filter((x) => x)} onChange={(rows) => setMotion('rows', rows)} />
        </fieldset>
      )}

      {cfg.motion && (
          <fieldset>
            <legend>草案對照表（另起一頁，可留空）</legend>
            <div className="grid">
              <Field label="草案名稱">
                <input value={doc.motion.draftTitle} placeholder="例：學生會組織章程修正草案"
                  onChange={(e) => setMotion('draftTitle', e.target.value)} />
              </Field>
              <Field label="類型">
                <select value={doc.motion.mode} onChange={(e) => setMotion('mode', e.target.value as DraftMode)}>
                  <option value="修正">修正（修正條文｜現行條文｜說明）</option>
                  <option value="新訂">新訂（條文｜說明）</option>
                </select>
              </Field>
            </div>
            <DraftTableEditor mode={doc.motion.mode} rows={doc.motion.rows}
              onChange={(rows) => setMotion('rows', rows)} />
          </fieldset>
      )}

      {cfg.letterhead && (
      <>
      <fieldset>
        <legend>附件{cfg.routing ? '與副本' : ''}</legend>
        <Field label="附件">
          <input value={doc.attachments} onChange={(e) => set('attachments', e.target.value)} />
        </Field>
        {cfg.routing && (
          <>
            <Field label="正本">
              <span className="with-picker">
                <input value={doc.primaryRecipients} onChange={(e) => set('primaryRecipients', e.target.value)} />
                <AgencyPicker agencies={agencies} value={doc.primaryRecipients} onChange={(v) => set('primaryRecipients', v)} />
              </span>
            </Field>
            <Field label="副本">
              <span className="with-picker">
                <input value={doc.ccRecipients} onChange={(e) => set('ccRecipients', e.target.value)} />
                <AgencyPicker agencies={agencies} value={doc.ccRecipients} onChange={(v) => set('ccRecipients', v)} />
              </span>
            </Field>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>簽名</legend>
        <label className="field-inline">
          <input type="checkbox" checked={doc.signature.enabled}
            onChange={(e) => setSignature('enabled', e.target.checked)} />
          於文件下方顯示簽名
        </label>
        <div className="grid">
          <Field label="頭銜">
            <input value={doc.signature.title} placeholder="例：學生議員"
              onChange={(e) => setSignature('title', e.target.value)} />
          </Field>
          <Field label="姓名">
            <input value={doc.signature.name}
              onChange={(e) => setSignature('name', e.target.value)} />
          </Field>
          <Field label="字體">
            <select value={doc.signature.font}
              onChange={(e) => setSignature('font', e.target.value as SignatureFont)}>
              <option value="yuji-boku">Yuji Boku（預設）</option>
              <option value="kai">標楷體</option>
              <option value="default">系統預設</option>
            </select>
          </Field>
        </div>
      </fieldset>
      </>
      )}
    </form>
  );
}
