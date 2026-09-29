export type TextField = HTMLTextAreaElement | HTMLInputElement;

/** 可插入用語的欄位：多行文字框與純文字輸入框（email、電話、日期等除外） */
export function isInsertable(el: EventTarget | null): el is TextField {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && el.type === 'text')
  );
}

/**
 * 在游標處插入文字，並觸發 input 事件，讓 React 受控欄位同步狀態。
 * 直接改 el.value 不會通知 React，所以要透過原生 setter。
 */
export function insertAtCursor(el: TextField, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
}
