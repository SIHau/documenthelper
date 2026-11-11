import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const TSX = join(ROOT, 'node_modules/.bin/tsx');
const EXAMPLES = join(ROOT, '.claude/skills/documenthelper/examples');

function dh(args: string[], input?: string) {
  const r = spawnSync(TSX, [join(ROOT, 'cli/dh.ts'), ...args], { encoding: 'utf8', input, cwd: ROOT });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe('dh 命令列', () => {
  it('skill 的範例稿件都能通過檢查', () => {
    const files = readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const r = dh(['check', join(EXAMPLES, f)]);
      expect(r.code, `${f}\n${r.out}${r.err}`).toBe(0);
      expect(r.out).toContain('沒有發現問題');
    }
  }, 60000);

  it('new 產生可讀回的稿件；空白稿檢查有錯誤時結束代碼為 1', () => {
    const made = dh(['new', '函', '--sender', '甲機關', '--recipient', '乙機關', '--date', '2026-11-09']);
    expect(made.code).toBe(0);
    expect(JSON.parse(made.out)).toMatchObject({ type: '函', sender: { name: '甲機關' }, date: '2026-11-09' });
    const check = dh(['check', '-', '--json'], made.out);
    expect(check.code).toBe(1);
    expect(JSON.parse(check.out).項目.map((i: { id: string }) => i.id)).toContain('subject-empty');
  }, 60000);

  it('稿件只寫用到的欄位也能檢查與預覽', () => {
    const doc = JSON.stringify({
      type: '函',
      sender: { name: '甲機關' },
      recipient: { name: '乙機關' },
      date: '2026-11-09',
      subject: '檢送資料一份，請查照。',
      attachments: '資料1份',
      explanation: [{ level: 0, text: '依據來文辦理。' }, { level: 1, text: '細項。' }],
    });
    expect(dh(['check', '-'], doc).code).toBe(0);
    const p = dh(['preview', '-'], doc);
    expect(p.out).toContain('一、依據來文辦理。');
    expect(p.out).toContain('(一)細項。');
    expect(p.out).toContain('中華民國115年11月9日');
  }, 60000);

  it('render 產生 PDF、ODT、DOCX，檔名為發文字號', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dh-'));
    const draft = join(dir, 'draft.json');
    writeFileSync(draft, readFileSync(join(EXAMPLES, 'letter.json')));
    const r = dh(['render', draft, '--format', 'all', '--out', join(dir, 'out')]);
    expect(r.code, r.err).toBe(0);
    for (const ext of ['pdf', 'odt', 'docx']) {
      const f = join(dir, 'out', `會字第1151109001號.${ext}`);
      expect(existsSync(f), f).toBe(true);
    }
    expect(readFileSync(join(dir, 'out', '會字第1151109001號.pdf')).subarray(0, 4).toString()).toBe('%PDF');
  }, 120000);

  it('輔助計算與錯誤處理', () => {
    expect(JSON.parse(dh(['deadline', '--date', '2026-11-09', '--urgency', '速件']).out).辦理期限).toBe('2026-11-12');
    expect(JSON.parse(dh(['docnumber', '--word', '議字', '--date', '2026-11-09', '--used', '議字第1151109001號']).out).發文字號).toBe('議字第1151109002號');
    expect(dh(['new', '不存在']).code).toBe(2);
    expect(dh(['nope']).code).toBe(2);
    expect(dh(['help']).out).toContain('render');
  }, 60000);
});
