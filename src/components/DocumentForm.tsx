import type { ReactNode } from 'react';
import type { Direction, DocType, OfficialDocument, Secrecy, Urgency } from '../model/types';
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

export function DocumentForm({ doc, onChange, onReset }: Props) {
  const set = <K extends keyof OfficialDocument>(key: K, value: OfficialDocument[K]) =>
    onChange({ ...doc, [key]: value });

  const measuresLabel = '辦法';

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
              <option value="函">函</option>
              <option value="書函">書函</option>
            </select>
          </Field>
          <Field label="行文方向">
            <select value={doc.direction} onChange={(e) => set('direction', e.target.value as Direction)}>
              <option>上行</option><option>平行</option><option>下行</option>
            </select>
          </Field>
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
          <Field label="發文日期">
            <input type="date" value={doc.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="發文字號">
            <input value={doc.docNumber} placeholder="例：府授字第1140001234號"
              onChange={(e) => set('docNumber', e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>機關與受文者</legend>
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
          <Field label="聯絡方式">
            <input value={doc.contact} placeholder="承辦人、電話、電子信箱"
              onChange={(e) => set('contact', e.target.value)} />
          </Field>
          <Field label="受文者">
            <input value={doc.recipient.name}
              onChange={(e) => set('recipient', { ...doc.recipient, name: e.target.value })} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend>主旨</legend>
        <textarea rows={3} value={doc.subject} placeholder="簡明扼要，一段完成，不分項"
          onChange={(e) => set('subject', e.target.value.replace(/\n/g, ''))} />
      </fieldset>

      <fieldset>
        <legend>說明</legend>
        <OutlineEditor items={doc.explanation} onChange={(v) => set('explanation', v)} />
      </fieldset>

      <fieldset>
        <legend>{measuresLabel}（可留空）</legend>
        <OutlineEditor items={doc.measures} onChange={(v) => set('measures', v)} />
      </fieldset>

      <fieldset>
        <legend>附件與副本</legend>
        <Field label="附件">
          <input value={doc.attachments} onChange={(e) => set('attachments', e.target.value)} />
        </Field>
        <Field label="正本">
          <input value={doc.primaryRecipients} onChange={(e) => set('primaryRecipients', e.target.value)} />
        </Field>
        <Field label="副本">
          <input value={doc.ccRecipients} onChange={(e) => set('ccRecipients', e.target.value)} />
        </Field>
      </fieldset>
    </form>
  );
}
