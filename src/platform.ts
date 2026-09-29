import { downloadBlob } from './export/download';

/** 是否在 Tauri 桌面版中執行 */
export const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * 儲存檔案。網頁版走瀏覽器下載；桌面版跳出「另存新檔」對話框並寫入所選位置
 * （桌面 WebView 對 <a download> 的支援不一致，所以不用）。
 * 回傳 false 表示使用者取消。
 */
export async function saveFile(data: Blob | Uint8Array, filename: string, mime: string): Promise<boolean> {
  if (!isDesktop()) {
    downloadBlob(data, filename, mime);
    return true;
  }
  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : '';
  const path = await save({
    defaultPath: filename,
    filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
  });
  if (!path) return false;
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  await writeFile(path, bytes);
  return true;
}
