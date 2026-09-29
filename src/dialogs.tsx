import { useEffect, useRef, useState } from 'react';

/**
 * 應用程式內的對話框，取代 window.alert / confirm / prompt。
 * 桌面版 WebView 對原生對話框的支援不一致（prompt 在多數平台無法使用），所以統一自己畫。
 */
type Request =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; message: string; value: string; resolve: (v: string | null) => void };

let enqueue: ((r: Request) => void) | null = null;

function ask<T>(make: (resolve: (v: T) => void) => Request, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    if (!enqueue) return resolve(fallback); // DialogHost 尚未掛載
    enqueue(make(resolve));
  });
}

export const alertDialog = (message: string) =>
  ask<void>((resolve) => ({ kind: 'alert', message, resolve }), undefined);
export const confirmDialog = (message: string) =>
  ask<boolean>((resolve) => ({ kind: 'confirm', message, resolve }), false);
export const promptDialog = (message: string, value = '') =>
  ask<string | null>((resolve) => ({ kind: 'prompt', message, value, resolve }), null);

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [text, setText] = useState('');
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (current?.kind === 'prompt') setText(current.value);
    if (current && current.kind !== 'prompt') okRef.current?.focus();
  }, [current]);

  if (!current) return null;

  const done = (ok: boolean) => {
    if (current.kind === 'alert') current.resolve();
    else if (current.kind === 'confirm') current.resolve(ok);
    else current.resolve(ok ? text : null);
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && done(false)}>
      <div className="modal" role="dialog" aria-modal="true">
        <p className="modal-msg">{current.message}</p>
        {current.kind === 'prompt' && (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && done(true)} />
        )}
        <div className="modal-actions">
          {current.kind !== 'alert' && <button type="button" onClick={() => done(false)}>取消</button>}
          <button type="button" ref={okRef} className="primary" onClick={() => done(true)}>確定</button>
        </div>
      </div>
    </div>
  );
}
