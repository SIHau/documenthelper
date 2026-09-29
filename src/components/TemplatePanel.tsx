import { useState } from 'react';
import type { TemplateRecord } from '../db/types';
import { BUILTIN_TEMPLATES } from '../data/builtinTemplates';
import type { OfficialDocument } from '../model/types';
import { confirmDialog, promptDialog } from '../dialogs';

interface Props {
  templates: TemplateRecord[];
  onApply: (doc: OfficialDocument) => void;
  onSaveCurrent: (name: string) => void;
  onRename: (t: TemplateRecord, name: string) => void;
  onRemove: (t: TemplateRecord) => void;
}

export function TemplatePanel({ templates, onApply, onSaveCurrent, onRename, onRemove }: Props) {
  const [name, setName] = useState('');
  const sorted = [...templates].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="data-panel">
      <h3>我的範本</h3>
      <div className="data-bar">
        <input value={name} placeholder="範本名稱" onChange={(e) => setName(e.target.value)} />
        <button type="button" disabled={!name.trim()} onClick={() => { onSaveCurrent(name.trim()); setName(''); }}>
          將目前稿件存為範本
        </button>
      </div>
      {!sorted.length && <p className="hint">還沒有自訂範本。範本會保留機關、受文者、內文與簽名，套用時日期改為今天、發文字號清空。</p>}
      <ul className="records">
        {sorted.map((t) => (
          <li key={t.id} className="record">
            <div className="record-main">
              <strong>{t.name}</strong>
              <span className="tag">{t.doc.type}</span>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => onApply(t.doc)}>套用</button>
              <button type="button" onClick={async () => { const n = await promptDialog('新的範本名稱', t.name); if (n?.trim()) onRename(t, n.trim()); }}>改名</button>
              <button type="button" onClick={async () => (await confirmDialog(`刪除範本「${t.name}」？`)) && onRemove(t)}>刪除</button>
            </div>
          </li>
        ))}
      </ul>

      <h3>內建範本</h3>
      <p className="hint">內容以「○」標示待填處。內建範本僅供參考，用語請依機關慣例調整。</p>
      <ul className="records">
        {BUILTIN_TEMPLATES.map((t) => (
          <li key={t.id} className="record">
            <div className="record-main">
              <strong>{t.name}</strong>
              <div className="record-meta">{t.description}</div>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => onApply(t.build())}>套用</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
