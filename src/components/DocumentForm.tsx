import type { ReactNode } from 'react';
import type { Direction, DocType, OfficialDocument, Secrecy, SignatureFont, Urgency } from '../model/types';
import { DOC_TYPES, DOC_TYPE_LIST } from '../model/docTypes';
import { OutlineEditor } from './OutlineEditor';

interface Props {
  doc: OfficialDocument;
  onChange: (doc: OfficialDocument) => void;
  onReset: () => void;
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
  ['remarks', '備註', true],
];

export function DocumentForm({ doc, onChange, onReset }: Props) {
  const cfg = DOC_TYPES[doc.type];
  const set = <K extends keyof OfficialDocument>(key: K, value: OfficialDocument[K]) =>
    onChange({ ...doc, [key]: value });
  const setContact = (key: keyof OfficialDocument['contact'], value: string) =>
    onChange({ ...doc, contact: { ...doc.contact, [key]: value } });
  const setMeeting = (key: keyof OfficialDocument['meeting'], value: string) =>
    onChange({ ...doc, meeting: { ...doc.meeting, [key]: value } });
  const setSignature = <K extends keyof OfficialDocument['signature']>(
    key: K,
    value: OfficialDocument['signature'][K],
  ) => onChange({ ...doc, signature: { ...doc.signature, [key]: value } });

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      <div className="form-head">
        <h2>公文內容</h2>
        <button type="button" onClick={() => confirm('確定清除目前草稿？') && onReset()}>
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
          <Field label="行文方向">
            <select value={doc.direction} onChange={(e) => set('direction', e.target.value as Direction)}>
              <option>上行</option><option>平行</option><option>下行</option>
            </select>
          </Field>
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
          <Field label={cfg.dateLabel}>
            <input type="date" value={doc.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          {cfg.docNumber && (
            <Field label="發文字號">
              <input value={doc.docNumber} placeholder="例：府授字第1140001234號"
                onChange={(e) => set('docNumber', e.target.value)} />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>機關與{cfg.recipient ? cfg.recipientLabel : '聯絡'}</legend>
        <div className="grid">
          <Field label="發文機關">
            <input value={doc.sender.name}
              onChange={(e) => set('sender', { ...doc.sender, name: e.target.value })} />
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
          <Field label="電子信箱">
            <input type="email" value={doc.contact.email}
              onChange={(e) => setContact('email', e.target.value)} />
          </Field>
          <Field label="傳真">
            <input type="tel" value={doc.contact.fax}
              onChange={(e) => setContact('fax', e.target.value)} />
          </Field>
          {cfg.recipient && (
            <Field label={cfg.recipientLabel}>
              <input value={doc.recipient.name}
                onChange={(e) => set('recipient', { ...doc.recipient, name: e.target.value })} />
            </Field>
          )}
        </div>
      </fieldset>

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

      {cfg.subject && (
        <fieldset>
          <legend>主旨</legend>
          <textarea rows={3} value={doc.subject} placeholder="簡明扼要，一段完成，不分項"
            onChange={(e) => set('subject', e.target.value.replace(/\n/g, ''))} />
        </fieldset>
      )}

      {cfg.explanationLabel && (
        <fieldset>
          <legend>{cfg.explanationLabel}</legend>
          <OutlineEditor items={doc.explanation} onChange={(v) => set('explanation', v)} />
        </fieldset>
      )}

      {cfg.measuresLabel && (
        <fieldset>
          <legend>{cfg.measuresLabel}（可留空）</legend>
          <OutlineEditor items={doc.measures} onChange={(v) => set('measures', v)} />
        </fieldset>
      )}

      <fieldset>
        <legend>附件{cfg.routing ? '與副本' : ''}</legend>
        <Field label="附件">
          <input value={doc.attachments} onChange={(e) => set('attachments', e.target.value)} />
        </Field>
        {cfg.routing && (
          <>
            <Field label="正本">
              <input value={doc.primaryRecipients} onChange={(e) => set('primaryRecipients', e.target.value)} />
            </Field>
            <Field label="副本">
              <input value={doc.ccRecipients} onChange={(e) => set('ccRecipients', e.target.value)} />
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
    </form>
  );
}
