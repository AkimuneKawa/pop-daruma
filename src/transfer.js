// 古いアドレス（GitHub Pages の pages/index.html）から引っ越してきたときに、URL の #import= のセーブや設定を取り込む。
// main.js の最初に読み込む（audio.js などが localStorage を読むより前に動かすため）。
// 決まったキーだけを、こちらにまだ値がないときだけ入れる（新しいアドレスで遊んだ分を上書きしない）
const KEYS = ['popdaruma_rt_v6', 'popdaruma_rt_v5', 'popdaruma_rt_v4', 'popdaruma_rt_v3', 'popdaruma_rt_v2', 'popdaruma_rt_v1',
  'popdaruma_sound', 'popdaruma_seen_version', 'popdaruma_name', 'popdaruma_tutorial_done'];
const SAVES = KEYS.filter(k => k.startsWith('popdaruma_rt_'));

export function importFromHash(hash = location.hash, store = localStorage) {
  const m = /^#import=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return 0;
  const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
  const hasSave = SAVES.some(k => store.getItem(k) != null);
  let n = 0;
  for (const k of KEYS) {
    const v = data[k];
    if (typeof v !== 'string' || store.getItem(k) != null) continue;
    if (SAVES.includes(k) && hasSave) continue; // こちらにセーブがあれば、古いセーブは入れない
    store.setItem(k, v); n++;
  }
  return n;
}

if (typeof location !== 'undefined' && location.hash.startsWith('#import=')) {
  try { importFromHash(); } catch (e) { /* 壊れたデータは無視 */ }
  history.replaceState(null, '', location.pathname + location.search);
}
