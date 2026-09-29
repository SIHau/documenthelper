import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckPanel } from './components/CheckPanel';
import { DocumentForm } from './components/DocumentForm';
import { PhrasePanel } from './components/PhrasePanel';
import { Preview } from './components/Preview';
import { emptyDocument } from './model/defaults';
import { loadDraft, saveDraft } from './storage';
import { buildOdt, ODT_MIME } from './export/odt';
import { buildDocx } from './export/docx';
import { exportFileName } from './export/layout';
import { downloadBlob } from './export/download';
import { checkDocument } from './rules';
import { insertAtCursor, isInsertable } from './phrases/insert';
import type { TextField } from './phrases/insert';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Tab = 'preview' | 'check' | 'phrases';

export function App() {
  const [doc, setDoc] = useState(loadDraft);
  const [tab, setTab] = useState<Tab>('preview');
  const [hasTarget, setHasTarget] = useState(false);
  const target = useRef<TextField | null>(null);

  useEffect(() => saveDraft(doc), [doc]);

  const issues = useMemo(() => checkDocument(doc), [doc]);
  const errorCount = issues.filter((i) => i.severity !== 'info').length;

  // 記住表單中最後一個游標所在的文字欄位，供用語庫插入
  const rememberField = (e: React.FocusEvent) => {
    if (isInsertable(e.target)) {
      target.current = e.target;
      setHasTarget(true);
    }
  };
  const insertPhrase = (text: string) => {
    const el = target.current;
    if (el && el.isConnected) insertAtCursor(el, text);
    else setHasTarget(false);
  };

  const printPreview = () => {
    setTab('preview');
    setTimeout(() => window.print(), 50);
  };

  const run = (fn: () => Promise<void>) => () =>
    fn().catch((e) => alert(`匯出失敗：${e instanceof Error ? e.message : e}`));
  const exportOdt = run(async () =>
    downloadBlob(await buildOdt(doc), exportFileName(doc, 'odt'), ODT_MIME));
  const exportDocx = run(async () =>
    downloadBlob(await buildDocx(doc), exportFileName(doc, 'docx'), DOCX_MIME));

  return (
    <div className="layout">
      <section className="pane pane-form" onFocusCapture={rememberField}>
        <DocumentForm doc={doc} onChange={setDoc} onReset={() => setDoc(emptyDocument())} />
      </section>
      <section className="pane pane-preview">
        <div className="toolbar">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>預覽</button>
            <button type="button" role="tab" aria-selected={tab === 'check'} onClick={() => setTab('check')}>
              檢查{errorCount > 0 && <span className="badge">{errorCount}</span>}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'phrases'} onClick={() => setTab('phrases')}>用語庫</button>
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={exportOdt}>匯出 ODT</button>
            <button type="button" onClick={exportDocx}>匯出 DOCX</button>
            <button type="button" onClick={printPreview}>列印／另存 PDF</button>
          </div>
        </div>
        {tab === 'preview' && <Preview doc={doc} />}
        {tab === 'check' && <CheckPanel issues={issues} />}
        {tab === 'phrases' && <PhrasePanel direction={doc.direction} onInsert={insertPhrase} hasTarget={hasTarget} />}
      </section>
    </div>
  );
}
