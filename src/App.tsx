import { useEffect, useState } from 'react';
import { DocumentForm } from './components/DocumentForm';
import { Preview } from './components/Preview';
import { emptyDocument } from './model/defaults';
import { loadDraft, saveDraft } from './storage';

export function App() {
  const [doc, setDoc] = useState(loadDraft);

  useEffect(() => saveDraft(doc), [doc]);

  return (
    <div className="layout">
      <section className="pane pane-form">
        <DocumentForm doc={doc} onChange={setDoc} onReset={() => setDoc(emptyDocument())} />
      </section>
      <section className="pane pane-preview">
        <div className="toolbar">
          <h2>預覽</h2>
          <button type="button" onClick={() => window.print()}>列印／另存 PDF</button>
        </div>
        <Preview doc={doc} />
      </section>
    </div>
  );
}
