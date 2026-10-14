import { describe, expect, it } from 'vitest';
import { defaultWord, nextDocNumber } from './docNumber';

describe('發文字號', () => {
  it('uses 民國年月日 plus a 3-digit daily serial', () => {
    expect(nextDocNumber('議字', '2026-10-14', [])).toBe('議字第1151014001號');
    const used = ['議字第1151014001號', '議字第 1151014007號', '議令字第1151014009號', '議字第1151013010號'];
    expect(nextDocNumber('議字', '2026-10-14', used)).toBe('議字第1151014008號');
    expect(nextDocNumber('議令字', '2026-10-14', used)).toBe('議令字第1151014010號');
    expect(nextDocNumber('議字', 'bad', used)).toBe('');
  });
  it('picks the word from the doc type and sender', () => {
    expect(defaultWord('令', '學生議會議長')).toBe('議令字');
    expect(defaultWord('函', '學生議會秘書長')).toBe('議秘字');
    expect(defaultWord('函', '學生議會')).toBe('議字');
    expect(defaultWord('開會通知單', '')).toBe('議通字');
  });
});
