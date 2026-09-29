import { useEffect, useState } from 'react';
import { DocumentForm } from './components/DocumentForm';
import { Preview } from './components/Preview';
import { emptyDocument } from './model/defaults';
import { loadDraft, saveDraft } from './storage';
import { buildOdt, ODT_MIME } from './export/odt';
import { buildDocx } from './export/docx';
import { exportFileName } from './export/layout';
import { downloadBlob } from './export/download';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function App() {
  const [doc, setDoc] = useState(loadDraft);

  useEffect(() => saveDraft(doc), [doc]);

  const run = (fn: () => Promise<void>) => () =>
    fn().catch((e) => alert(`匯出失敗：${e instanceof Error ? e.message : e}`));
  const exportOdt = run(async () =>
    downloadBlob(await buildOdt(doc), exportFileName(doc, 'odt'), ODT_MIME));
  const exportDocx = run(async () =>
    downloadBlob(await buildDocx(doc), exportFileName(doc, 'docx'), DOCX_MIME));

  return (
    <div className="layout">
      <section className="pane pane-form">
        <DocumentForm doc={doc} onChange={setDoc} onReset={() => setDoc(emptyDocument())} />
      </section>
      <section className="pane pane-preview">
        <div className="toolbar">
          <h2>預覽</h2>
          <div className="toolbar-actions">
            <button type="button" onClick={exportOdt}>匯出 ODT</button>
            <button type="button" onClick={exportDocx}>匯出 DOCX</button>
            <button type="button" onClick={() => window.print()}>列印／另存 PDF</button>
          </div>
        </div>
        <Preview doc={doc} />
      </section>
    </div>
  );
}
