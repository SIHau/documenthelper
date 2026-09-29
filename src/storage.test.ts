import { beforeEach, describe, expect, it } from 'vitest';
import { loadDraft } from './storage';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
});

describe('loadDraft migration', () => {
  it('converts legacy string contact to 承辦人', () => {
    store.set('documenthelper:draft:v1', JSON.stringify({ subject: 's', contact: '王小明' }));
    const d = loadDraft();
    expect(d.contact).toEqual({ person: '王小明', phone: '', email: '', fax: '' });
    expect(d.signature.font).toBe('yuji-boku');
    expect(d.subject).toBe('s');
  });
});
