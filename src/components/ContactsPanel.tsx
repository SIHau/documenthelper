import { useRef, useState } from 'react';
import type { Agency } from '../db/types';
import { agenciesToCsv, csvToAgencies, emptyAgency, mergeAgencies } from '../db/csv';
import { downloadBlob } from '../export/download';
import { matchAgency } from '../search';

interface Props {
  agencies: Agency[];
  onSave: (a: Agency) => void;
  onSaveMany: (list: Agency[]) => void;
  onRemove: (id: string) => void;
}

const FIELDS: Array<[keyof Agency, string]> = [
  ['name', '名稱'], ['code', '機關代碼'], ['address', '地址'], ['phone', '電話'],
  ['fax', '傳真'], ['email', '電子信箱'], ['note', '備註'],
];

export function ContactsPanel({ agencies, onSave, onSaveMany, onRemove }: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Agency | null>(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const list = agencies.filter((a) => matchAgency(a, query)).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  const submit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setMessage('請填寫名稱');
    const dup = agencies.find((a) => a.name.trim() === name && a.id !== editing.id);
    if (dup) return setMessage(`通訊錄已有「${name}」`);
    onSave({ ...editing, name });
    setEditing(null);
    setMessage('');
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const incoming = csvToAgencies(text);
      const { merged, added, updated } = mergeAgencies(agencies, incoming);
      onSaveMany(merged);
      setMessage(`匯入完成：新增 ${added} 筆，更新 ${updated} 筆`);
    } catch (e) {
      setMessage(`匯入失敗：${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="data-panel">
      <div className="data-bar">
        <input type="search" placeholder="搜尋名稱、代碼、地址…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" onClick={() => setEditing(emptyAgency())}>＋ 新增</button>
        <button type="button" onClick={() => fileRef.current?.click()}>匯入 CSV</button>
        <button type="button" disabled={!agencies.length}
          onClick={() => downloadBlob(new Blob([agenciesToCsv(agencies)], { type: 'text/csv;charset=utf-8' }), '通訊錄.csv', 'text/csv')}>
          匯出 CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </div>
      <p className="hint">CSV 第一列為標題：{['名稱', '代碼', '地址', '電話', '傳真', '電子信箱', '備註'].join('、')}（只有「名稱」必填）。機關代碼請自行填入，本工具不內建官方代碼表。</p>
      {message && <p className="hint hint-warn">{message}</p>}

      {editing && (
        <div className="edit-box">
          {FIELDS.map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input value={editing[key]} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
            </label>
          ))}
          <div className="row-actions">
            <button type="button" onClick={submit}>儲存</button>
            <button type="button" onClick={() => { setEditing(null); setMessage(''); }}>取消</button>
          </div>
        </div>
      )}

      {!list.length && <p className="hint">{agencies.length ? '沒有符合的項目。' : '通訊錄是空的，請新增或匯入。'}</p>}
      <ul className="records">
        {list.map((a) => (
          <li key={a.id} className="record">
            <div className="record-main">
              <strong>{a.name}</strong>
              {a.code && <span className="tag">{a.code}</span>}
              <div className="record-meta">{[a.address, a.phone, a.email].filter(Boolean).join('　')}</div>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => setEditing(a)}>編輯</button>
              <button type="button" onClick={() => confirm(`刪除「${a.name}」？`) && onRemove(a.id)}>刪除</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
