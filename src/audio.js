// BGM と効果音。BGM は月ごとの曲（public/bgm/）、効果音は Web Audio でその場で合成する（SFC 風）。
// ブラウザの制約で、最初のタップ（unlock）までは音を出さない
const MODE_KEY = 'popdaruma_sound';
export const MODES = ['all', 'se', 'off']; // ぜんぶ／効果音だけ／なし
export const MODE_LABEL = { all: '音：ぜんぶ', se: '音：効果音だけ', off: '音：なし' };

let ctx = null, master, bgmBus, sfxBus;
let mode = 'all';
try { mode = localStorage.getItem(MODE_KEY) || 'all'; } catch (e) { /* 保存できない環境 */ }
if (!MODES.includes(mode)) mode = 'all';

export const getMode = () => mode;
// テスト用：音声の状態（AudioContext の状態と、いま鳴っている BGM）
export const debugState = () => ({ ctx: ctx?.state ?? 'none', bgm: bgmTrack() });
export function setMode(m) {
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 保存できない環境 */ }
  if (!ctx) return;
  sfxBus.gain.value = m === 'off' ? 0 : 0.5;
  bgmBus.gain.value = m === 'all' ? 0.35 : 0; // 曲は効果音より控えめに
}

// 最初のユーザー操作で呼ぶ
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    setMode(mode);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
const ready = () => ctx && ctx.state === 'running';
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

// 1音。type＝波形、f＝周波数、t＝開始時刻、dur＝長さ、vol＝音量、bus＝出力先
function tone(bus, type, f, t, dur, vol, { slide, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(bus, t, dur, vol, { hp = 1000, lp = 12000 } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(), h = ctx.createBiquadFilter(), l = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(h); h.connect(l); l.connect(g); g.connect(bus);
  s.start(t); s.stop(t + dur + 0.02);
}

/* ---------- 効果音 ---------- */
// チャリーン：一瞬の金属音「チャ」＋高く澄んだ余韻「リーン」
function chaRin(t, vol = 1, pitch = 0) {
  const k = Math.pow(2, pitch / 12);
  noise(sfxBus, t, 0.03, 0.25 * vol, { hp: 5000 });
  tone(sfxBus, 'square', 1976 * k, t, 0.06, 0.12 * vol); // チャ（B6）
  const t2 = t + 0.055;
  tone(sfxBus, 'sine', 2637 * k, t2, 0.7, 0.3 * vol, { attack: 0.003 }); // リーン（E7）
  tone(sfxBus, 'sine', 2637 * 2.76 * k, t2, 0.35, 0.06 * vol, { attack: 0.003 }); // 金属っぽい倍音
  tone(sfxBus, 'triangle', 1319 * k, t2, 0.5, 0.08 * vol);
}
// 売れたとき。まとめ買い（5個以上）は硬貨を重ねてジャラジャラ。鳴りすぎないよう間引く
let lastCoin = 0, lastPile = 0;
export function sold(n) {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (n >= 5) {
    if (t - lastPile < 0.35) return;
    lastPile = t; lastCoin = t;
    const coins = Math.min(6, 2 + Math.floor(n / 15));
    for (let i = 0; i < coins; i++) chaRin(t + i * 0.06, 0.8, (i % 3) * 2);
    return;
  }
  if (t - lastCoin < 0.09) return;
  lastCoin = t;
  chaRin(t, 0.9, Math.floor(Math.random() * 3));
}
let lastMiss = 0;
export function soldOut() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastMiss < 0.4) return;
  lastMiss = t;
  tone(sfxBus, 'triangle', 330, t, 0.18, 0.15, { slide: 180 });
}
export function click() {
  if (!ready()) return;
  tone(sfxBus, 'square', 1200, ctx.currentTime, 0.04, 0.08);
}
export function buy() { // ドサッ（箱を置く音）
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(sfxBus, 'sine', 160, t, 0.15, 0.4, { slide: 60 });
  noise(sfxBus, t, 0.08, 0.2, { hp: 200, lp: 1500 });
}
function arpeggio(notes, step, type = 'square', vol = 0.15) {
  if (!ready()) return;
  const t = ctx.currentTime;
  notes.forEach((n, i) => tone(sfxBus, type, hz(n), t + i * step, step * 1.8, vol));
}
export const invest = () => arpeggio([72, 76, 79, 84], 0.07); // ドミソド
export const hire = () => arpeggio([74, 78, 81, 86, 81, 86], 0.08); // 小さなファンファーレ
export const news = () => arpeggio([88, 84], 0.12, 'triangle', 0.18); // ピンポン
export const levelUp = () => arpeggio([79, 83, 86, 91, 86, 91, 95], 0.07, 'square', 0.15); // キラキラ上昇
export const ad = () => arpeggio([67, 72, 76, 79, 84], 0.06, 'square', 0.14); // 宣伝のジングル
export const short = () => arpeggio([60, 59, 58, 57], 0.12, 'sawtooth', 0.12); // ブブー
export function end(bankrupt) {
  if (bankrupt) arpeggio([67, 63, 60, 55], 0.22, 'triangle', 0.2);
  else arpeggio([72, 74, 76, 79, 76, 79, 84], 0.11, 'square', 0.16);
}

/* ---------- BGM ---------- */
// 月ごとの曲（public/bgm/*.mp3。ファイル名は流す月）。月の並びは MONTHS と同じ4月始まり（0＝4月〜11＝3月）
const TRACK_BY_MONTH = ['4', '5-7', '5-7', '5-7', '8-9', '8-9', '10', '11-12', '11-12', '1', '2', '3'];
export const trackForMonth = mo => TRACK_BY_MONTH[mo];
const trackUrl = key => `${import.meta.env.BASE_URL}bgm/${key}.mp3`;
const FADE = 1.5; // 曲を切り替えるときのフェード（秒）

// プレーヤーを2つ用意して使い回す（iPhone では、操作と関係ないタイミングで新しい音を鳴らせないことがあるため）。
// それぞれ Web Audio につないで、音量を bgmBus と自分のゲインで決める
let decks = null, cur = null; // cur＝いま鳴らしているプレーヤー { el, gain, key }
function ensureDecks() {
  if (decks || !ctx) return;
  decks = [0, 1].map(() => {
    const el = new Audio();
    el.loop = true; el.preload = 'auto';
    const gain = ctx.createGain(); gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain); gain.connect(bgmBus);
    return { el, gain, key: null };
  });
}
function fadeTo(d, v, sec) {
  const t = ctx.currentTime, g = d.gain.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + sec);
}
// key の曲を流す（同じ曲なら続きから）。「音：ぜんぶ」以外では流さない
export function playBgm(key) {
  if (!ctx || mode !== 'all') { stopBgm(); return; }
  ensureDecks();
  if (cur && cur.key === key) {
    if (cur.el.paused || cur.stopping) { cur.stopping = false; cur.el.play().catch(() => {}); fadeTo(cur, 1, 0.3); }
    return;
  }
  const next = decks.find(d => d !== cur);
  if (next.key !== key) { next.el.src = trackUrl(key); next.key = key; next.el.currentTime = 0; }
  next.stopping = false;
  next.el.play().catch(() => {});
  fadeTo(next, 1, cur ? FADE : 0.3);
  if (cur) { const prev = cur; fadeTo(prev, 0, FADE); setTimeout(() => { if (prev !== cur) prev.el.pause(); }, FADE * 1000 + 100); }
  cur = next;
}
// 止める（次に同じ曲を流すと続きから）
export function stopBgm() {
  if (!cur) return;
  const d = cur;
  d.stopping = true; // 音を小さくしてから止める（そのあいだに再開されたら止めない）
  fadeTo(d, 0, 0.3);
  setTimeout(() => { if (d.stopping || d !== cur) d.el.pause(); }, 350);
  if (mode !== 'all') cur = null;
}
export const bgmTrack = () => (cur && !cur.el.paused && !cur.stopping ? cur.key : null);
