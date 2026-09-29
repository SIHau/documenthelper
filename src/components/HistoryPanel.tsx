import { useRef, useState } from 'react';
import type { DraftRecord } from '../db/types';
import { DOC_TYPE_LIST } from '../model/docTypes';
import type { DocType } from '../model/types';
import { matchDraft } from '../search';

interface Props {
  drafts: DraftRecord[];
  currentId: string | null;
  onSave: () => void;
  onNew: () => void;
  onOpen: (r: DraftRecord) => void;
  onDuplicate: (r: DraftRecord) => void;
  onRemove: (r: DraftRecord) => void;
  onExportAll: () => void;
  onImportAll: (file: File) => void;
}

const fmt = (t: number) => new Date(t).toLocaleString('zh-TW', { hour12: false });

export function HistoryPanel(p: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'' | DocType>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const list = p.drafts
    .filter((r) => (!type || r.doc.type === type) && matchDraft(r, query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="data-panel">
      <div className="data-bar">
        <button type="button" onClick={p.onSave}>{p.currentId ? '儲存變更' : '儲存至歷史'}</button>
        <button type="button" onClick={p.onNew}>新增空白稿</button>
      </div>
      <div className="data-bar">
        <input type="search" placeholder="搜尋主旨、受文者、字號、內容…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as '' | DocType)}>
          <option value="">全部文種</option>
          {DOC_TYPE_LIST.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {!list.length && <p className="hint">{p.drafts.length ? '沒有符合的稿件。' : '尚無歷史稿件。編輯後按「儲存至歷史」即可保存。'}</p>}
      <ul className="records">
        {list.map((r) => (
          <li key={r.id} className={r.id === p.currentId ? 'record record-current' : 'record'}>
            <div className="record-main">
              <strong>{r.title}</strong>
              <span className="tag">{r.doc.type}</span>
              {r.id === p.currentId && <span className="tag tag-cur">編輯中</span>}
              <div className="record-meta">
                {[r.doc.recipient.name && `受文者：${r.doc.recipient.name}`, r.doc.docNumber, `更新：${fmt(r.updatedAt)}`].filter(Boolean).join('　')}
              </div>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => p.onOpen(r)}>開啟</button>
              <button type="button" title="以此稿為底，建立新稿" onClick={() => p.onDuplicate(r)}>複製</button>
              <button type="button" onClick={() => confirm(`刪除「${r.title}」？`) && p.onRemove(r)}>刪除</button>
            </div>
          </li>
        ))}
      </ul>

      <details className="backup">
        <summary>備份與還原</summary>
        <p className="hint">資料只存在這個瀏覽器中，清除瀏覽資料或換電腦都會消失。請定期備份（包含稿件、範本、通訊錄）。</p>
        <div className="data-bar">
          <button type="button" onClick={p.onExportAll}>匯出全部資料</button>
          <button type="button" onClick={() => fileRef.current?.click()}>從備份檔還原</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImportAll(f); e.target.value = ''; }} />
        </div>
      </details>
    </div>
  );
}
