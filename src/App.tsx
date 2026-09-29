import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckPanel } from './components/CheckPanel';
import { ContactsPanel } from './components/ContactsPanel';
import { DocumentForm } from './components/DocumentForm';
import { HistoryPanel } from './components/HistoryPanel';
import { PhrasePanel } from './components/PhrasePanel';
import { Preview } from './components/Preview';
import { TemplatePanel } from './components/TemplatePanel';
import { emptyDocument, newId } from './model/defaults';
import { todayIso } from './model/date';
import { draftTitle, instantiate, isBlank } from './model/template';
import { loadDraft, saveDraft } from './storage';
import { buildOdt, ODT_MIME } from './export/odt';
import { buildDocx } from './export/docx';
import { exportFileName } from './export/layout';
import { downloadBlob } from './export/download';
import { checkDocument } from './rules';
import { insertAtCursor, isInsertable } from './phrases/insert';
import type { TextField } from './phrases/insert';
import { useRecords } from './db/useRecords';
import { exportAll, parseBackup, restore } from './db/backup';
import type { Agency, DraftRecord, TemplateRecord } from './db/types';
import type { OfficialDocument } from './model/types';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CURRENT_KEY = 'documenthelper:currentId';

type Tab = 'preview' | 'check' | 'phrases' | 'history' | 'templates' | 'contacts';
const TABS: Array<[Tab, string]> = [
  ['preview', '預覽'], ['check', '檢查'], ['phrases', '用語庫'],
  ['history', '稿件'], ['templates', '範本'], ['contacts', '通訊錄'],
];

function loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function App() {
  const [doc, setDoc] = useState(loadDraft);
  const [tab, setTab] = useState<Tab>('preview');
  const [hasTarget, setHasTarget] = useState(false);
  const target = useRef<TextField | null>(null);

  const contacts = useRecords<Agency>('contacts');
  const drafts = useRecords<DraftRecord>('drafts');
  const templates = useRecords<TemplateRecord>('templates');

  const [currentId, setCurrentIdState] = useState<string | null>(loadCurrentId);
  /** 最近一次存入歷史（或從歷史開啟）時的內容，用來判斷是否有未儲存的變更 */
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const setCurrentId = (id: string | null) => {
    setCurrentIdState(id);
    try {
      if (id) localStorage.setItem(CURRENT_KEY, id);
      else localStorage.removeItem(CURRENT_KEY);
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => saveDraft(doc), [doc]);

  // 歷史稿件已被刪除或清除時，解除「編輯中」的關聯
  useEffect(() => {
    if (drafts.ready && currentId && !drafts.items.some((d) => d.id === currentId)) setCurrentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts.ready, drafts.items, currentId]);
  // 重新整理後，若編輯中的稿件內容與歷史相同，視為已儲存
  useEffect(() => {
    if (savedJson === null && currentId) {
      const rec = drafts.items.find((d) => d.id === currentId);
      if (rec && JSON.stringify(rec.doc) === JSON.stringify(doc)) setSavedJson(JSON.stringify(doc));
    }
  }, [drafts.items, currentId, doc, savedJson]);

  const issues = useMemo(() => checkDocument(doc), [doc]);
  const errorCount = issues.filter((i) => i.severity !== 'info').length;

  const dirty = savedJson !== null ? JSON.stringify(doc) !== savedJson : !isBlank(doc);
  const confirmDiscard = () => !dirty || confirm('目前稿件有尚未儲存至歷史的變更，確定要覆蓋嗎？');

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

  const load = (next: OfficialDocument, id: string | null, saved: boolean) => {
    setDoc(next);
    setCurrentId(id);
    setSavedJson(saved ? JSON.stringify(next) : null);
    setTab('preview');
  };

  // ---- 歷史稿件
  const saveToHistory = async () => {
    const id = currentId ?? newId();
    await drafts.save({ id, title: draftTitle(doc), doc, updatedAt: Date.now() });
    setCurrentId(id);
    setSavedJson(JSON.stringify(doc));
  };
  const newBlank = () => confirmDiscard() && load(emptyDocument(), null, false);
  const openDraft = (r: DraftRecord) => confirmDiscard() && load(r.doc, r.id, true);
  const duplicateDraft = async (r: DraftRecord) => {
    if (!confirmDiscard()) return;
    const copy = instantiate(r.doc);
    const id = newId();
    await drafts.save({ id, title: draftTitle(copy), doc: copy, updatedAt: Date.now() });
    load(copy, id, true);
  };
  const removeDraft = async (r: DraftRecord) => {
    await drafts.remove(r.id);
    if (r.id === currentId) {
      setCurrentId(null);
      setSavedJson(null);
    }
  };

  // ---- 範本
  const applyTemplate = (saved: OfficialDocument) => {
    if (!confirmDiscard()) return;
    const next = instantiate(saved, todayIso());
    load(next, null, false);
  };
  const saveAsTemplate = (name: string) =>
    templates.save({ id: newId(), name, doc, createdAt: Date.now() });

  // ---- 備份
  const backupAll = async () => {
    const data = await exportAll();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `公文小幫手備份_${todayIso()}.json`, 'application/json');
  };
  const restoreAll = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`將還原 ${backup.drafts.length} 份稿件、${backup.templates.length} 個範本、${backup.contacts.length} 筆通訊錄。\n相同項目會被覆蓋，其餘資料保留。要繼續嗎？`)) return;
      await restore(backup);
      await Promise.all([contacts.reload(), drafts.reload(), templates.reload()]);
      alert('還原完成');
    } catch (e) {
      alert(`還原失敗：${e instanceof Error ? e.message : e}`);
    }
  };

  // ---- 匯出
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

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      // pdf-lib 與字體邏輯較大，點擊時才載入
      const [{ buildPdf }, { browserPdfFonts }] = await Promise.all([
        import('./export/pdf'),
        import('./export/pdfFonts.browser'),
      ]);
      const { bytes, missing } = await buildPdf(doc, browserPdfFonts());
      downloadBlob(bytes, exportFileName(doc, 'pdf'), PDF_MIME);
      if (missing.length) alert(`PDF 字體不含以下字元，已略過：${missing.join(' ')}`);
    } catch (e) {
      alert(`PDF 產生失敗：${e instanceof Error ? e.message : e}`);
    } finally {
      setPdfBusy(false);
    }
  };

  const storageError = contacts.error || drafts.error || templates.error;

  return (
    <div className="layout">
      <section className="pane pane-form" onFocusCapture={rememberField}>
        <DocumentForm
          doc={doc}
          agencies={contacts.items}
          onChange={setDoc}
          onReset={() => load(emptyDocument(), null, false)}
        />
      </section>
      <section className="pane pane-preview">
        {storageError && (
          <p className="banner">無法使用瀏覽器儲存空間（{storageError}）。稿件、範本與通訊錄本次操作可用，但關閉頁面後不會保留。</p>
        )}
        <div className="toolbar">
          <div className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
                {id === 'check' && errorCount > 0 && <span className="badge">{errorCount}</span>}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={() => void exportPdf()} disabled={pdfBusy}>
              {pdfBusy ? '產生中…' : '下載 PDF'}
            </button>
            <button type="button" onClick={exportOdt}>匯出 ODT</button>
            <button type="button" onClick={exportDocx}>匯出 DOCX</button>
            <button type="button" onClick={printPreview}>列印</button>
          </div>
        </div>
        {dirty && currentId && tab !== 'history' && <p className="hint">編輯中的歷史稿件有未儲存的變更（到「稿件」頁籤按「儲存變更」）。</p>}
        {tab === 'preview' && <Preview doc={doc} />}
        {tab === 'check' && <CheckPanel issues={issues} />}
        {tab === 'phrases' && <PhrasePanel direction={doc.direction} onInsert={insertPhrase} hasTarget={hasTarget} />}
        {tab === 'history' && (
          <HistoryPanel
            drafts={drafts.items}
            currentId={currentId}
            onSave={saveToHistory}
            onNew={newBlank}
            onOpen={openDraft}
            onDuplicate={duplicateDraft}
            onRemove={removeDraft}
            onExportAll={run(backupAll)}
            onImportAll={restoreAll}
          />
        )}
        {tab === 'templates' && (
          <TemplatePanel
            templates={templates.items}
            onApply={applyTemplate}
            onSaveCurrent={saveAsTemplate}
            onRename={(t, name) => templates.save({ ...t, name })}
            onRemove={(t) => templates.remove(t.id)}
          />
        )}
        {tab === 'contacts' && (
          <ContactsPanel
            agencies={contacts.items}
            onSave={contacts.save}
            onSaveMany={contacts.saveMany}
            onRemove={contacts.remove}
          />
        )}
      </section>
    </div>
  );
}
