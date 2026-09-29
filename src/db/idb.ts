import { STORE_NAMES } from './types';
import type { StoreName } from './types';

const DB_NAME = 'documenthelper';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('此瀏覽器不支援 IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORE_NAMES) {
          if (!req.result.objectStoreNames.contains(name)) {
            req.result.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('無法開啟資料庫'));
    });
    // 開啟失敗時清除快取，允許之後重試
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** 在單一 transaction 中執行；寫入類操作等到 transaction 完成才 resolve */
async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error('資料庫寫入失敗'));
    tx.onabort = () => reject(tx.error ?? new Error('資料庫交易中止'));
  });
}

export const idb = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    return ((await run<T[]>(store, 'readonly', (s) => s.getAll())) ?? []) as T[];
  },
  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    await run(store, 'readwrite', (s) => {
      s.put(value);
    });
  },
  async putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    await run(store, 'readwrite', (s) => {
      for (const v of values) s.put(v);
    });
  },
  async remove(store: StoreName, id: string): Promise<void> {
    await run(store, 'readwrite', (s) => {
      s.delete(id);
    });
  },
  async clear(store: StoreName): Promise<void> {
    await run(store, 'readwrite', (s) => {
      s.clear();
    });
  },
};
