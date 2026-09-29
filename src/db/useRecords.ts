import { useCallback, useEffect, useState } from 'react';
import { idb } from './idb';
import type { StoreName } from './types';

/**
 * 讀寫某個 IndexedDB store 的 React hook。
 * 寫入失敗（例如隱私模式）時仍更新畫面，但提示資料不會被保留。
 */
export function useRecords<T extends { id: string }>(store: StoreName) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await idb.getAll<T>(store));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (item: T) => {
      setItems((prev) => (prev.some((p) => p.id === item.id) ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]));
      try {
        await idb.put(store, item);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [store],
  );

  const saveMany = useCallback(
    async (list: T[]) => {
      const ids = new Set(list.map((i) => i.id));
      setItems((prev) => [...prev.filter((p) => !ids.has(p.id)), ...list]);
      try {
        await idb.putMany(store, list);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [store],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((p) => p.id !== id));
      try {
        await idb.remove(store, id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [store],
  );

  return { items, ready, error, save, saveMany, remove, reload };
}
