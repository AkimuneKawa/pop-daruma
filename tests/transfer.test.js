import { describe, it, expect } from 'vitest';
import { importFromHash } from '../src/transfer.js';

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
// pages/index.html と同じ作り方（UTF-8 → base64url）
const hashOf = data => '#import=' + Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('古いアドレスからの引っ越し', () => {
  it('決まったキーだけを取り込む（日本語も壊れない）', () => {
    const s = store();
    const n = importFromHash(hashOf({ popdaruma_rt_v5: '{"cash":1}', popdaruma_name: 'だるま太郎', popdaruma_sound: 'se', evil: 'x' }), s);
    expect(n).toBe(3);
    expect(s.getItem('popdaruma_name')).toBe('だるま太郎');
    expect(s.getItem('evil')).toBeNull();
  });
  it('こちらにセーブや設定があれば上書きしない', () => {
    const s = store({ popdaruma_rt_v6: 'mine', popdaruma_sound: 'off' });
    importFromHash(hashOf({ popdaruma_rt_v5: 'old', popdaruma_sound: 'all', popdaruma_seen_version: '2.5' }), s);
    expect(s.getItem('popdaruma_rt_v5')).toBeNull();
    expect(s.getItem('popdaruma_sound')).toBe('off');
    expect(s.getItem('popdaruma_seen_version')).toBe('2.5');
  });
  it('#import= でなければ何もしない', () => {
    expect(importFromHash('#foo', store())).toBe(0);
  });
});
