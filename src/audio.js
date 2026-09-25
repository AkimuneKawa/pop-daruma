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
// 効果音は流れている曲の調に合わせる（BGM とぶつからないように）。
// 曲ごとの調（主音の MIDI 番号・短調か）と明るさ（0〜1。やわらかい曲ほど丸い音にする）は、曲を分析して決めた
const TRACK_KEY = {
  '4': { root: 69, minor: false, bright: 1 }, // イ長調
  '5-7': { root: 63, minor: false, bright: 0.4 }, // 変ホ長調
  '8-9': { root: 62, minor: false, bright: 0.7 }, // ニ長調
  '10': { root: 67, minor: true, bright: 0.8 }, // ト短調
  '11-12': { root: 67, minor: true, bright: 1 }, // ト短調
  '1': { root: 71, minor: true, bright: 0.5 }, // ロ短調
  '2': { root: 62, minor: true, bright: 1 }, // ニ短調
  '3': { root: 67, minor: false, bright: 0.55 }, // ト長調
};
export const KEY_NAMES = { '4': 'A', '5-7': 'E♭', '8-9': 'D', '10': 'Gm', '11-12': 'Gm', '1': 'Bm', '2': 'Dm', '3': 'G' };
let sfxKey = TRACK_KEY['4'], sfxTrack = '4';
// 効果音の調を、その曲の調にする（BGM の切り替えと、デバッグの試聴で呼ぶ）
export function setSfxTrack(track) { if (TRACK_KEY[track]) { sfxKey = TRACK_KEY[track]; sfxTrack = track; } }
export const sfxTrackNow = () => sfxTrack;

// 長調の音階。短調の曲では同じ音の並びの長調（平行調）を使い、お金の音が明るく響くようにする
const SCALE = [0, 2, 4, 5, 7, 9, 11];
function note(deg, oct = 0) {
  const M = sfxKey.minor ? sfxKey.root + 3 : sfxKey.root;
  const base = 60 + (((M - 60) % 12) + 12) % 12; // 主音を C4〜B4 にそろえる
  const d = ((deg % 7) + 7) % 7, o = Math.floor(deg / 7);
  return base + SCALE[d] + 12 * (o + oct);
}

// ベル（FM 合成）：硬貨やレジの「チン」
function bell(t, midi, vol, dur = 0.9) {
  const f = hz(midi), c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.type = 'sine'; m.type = 'sine';
  c.frequency.value = f; m.frequency.value = f * 3.5;
  mg.gain.setValueAtTime(f * (1.5 + 2 * sfxKey.bright), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(sfxBus);
  c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
}
// 鉄琴・マリンバ：アルペジオやジングル
function marimba(t, midi, vol, dur = 0.45) {
  tone(sfxBus, 'sine', hz(midi), t, dur, vol, { attack: 0.003 });
  tone(sfxBus, 'sine', hz(midi) * 4, t, dur * 0.25, vol * 0.25 * (0.5 + sfxKey.bright), { attack: 0.002 });
}
// 硬貨がふれあう小さな音
function clink(t, vol) {
  noise(sfxBus, t, 0.025, 0.2 * vol, { hp: 6000 });
  bell(t, note(4, 2) + (Math.random() < 0.5 ? 0 : 12), 0.12 * vol, 0.18);
}
// やわらかい和音
function pad(t, degs, oct, vol, dur = 0.9) {
  for (const d of degs) tone(sfxBus, 'triangle', hz(note(d, oct)), t, dur, vol, { attack: 0.02 });
}

// お金が入る音：売上額の段階（小・中・大）ごとに3種類。ランダムに選ぶ
const COIN = {
  small: [
    (t, v) => { clink(t, v); bell(t + 0.05, note(4, 1), 0.28 * v, 0.6); bell(t + 0.11, note(0, 2), 0.3 * v, 0.8); }, // チャリン
    (t, v) => { [0, 2, 4].forEach((d, i) => marimba(t + i * 0.045, note(d, 1), 0.22 * v, 0.35)); }, // 小さな上昇
    (t, v) => { bell(t, note(2, 2), 0.3 * v, 0.9); bell(t + 0.08, note(4, 2), 0.1 * v, 0.6); }, // リン
  ],
  medium: [
    (t, v) => { [0, 2, 4, 7].forEach((d, i) => marimba(t + i * 0.05, note(d, 1), 0.24 * v, 0.4)); for (let i = 0; i < 3; i++) clink(t + 0.18 + i * 0.05, 0.7 * v); }, // 上昇＋きらめき
    (t, v) => { clink(t, v); clink(t + 0.07, v); [0, 2, 4].forEach(d => bell(t + 0.12, note(d, 1), 0.16 * v, 1)); }, // 硬貨2枚＋和音
    (t, v) => { bell(t, note(0, 2), 0.32 * v, 1.2); [2, 4, 7].forEach((d, i) => marimba(t + 0.12 + i * 0.05, note(d, 1), 0.2 * v, 0.35)); }, // レジのチン＋上昇
  ],
  large: [
    (t, v) => { for (let i = 0; i < 9; i++) clink(t + i * 0.055 + Math.random() * 0.02, v); pad(t + 0.1, [0, 2, 4], 0, 0.1 * v, 1.2); [0, 2, 4].forEach(d => bell(t + 0.45, note(d, 1), 0.14 * v, 1.2)); }, // ジャラーン＋和音
    (t, v) => { [0, 2, 4].forEach((d, i) => marimba(t + i * 0.08, note(d, 1), 0.26 * v, 0.3)); [7, 9, 11].forEach(d => bell(t + 0.26, note(d, 1), 0.16 * v, 1.3)); pad(t + 0.26, [0, 4], 0, 0.1 * v, 1.2); }, // ファンファーレ
    (t, v) => { bell(t, note(0, 2), 0.34 * v, 1.4); for (let i = 0; i < 6; i++) clink(t + 0.15 + i * 0.06, 0.9 * v); marimba(t + 0.15, note(0, -1), 0.3 * v, 0.6); }, // チーン＋硬貨の山
  ],
};
export const COIN_TIERS = { small: '小（1万円未満）', medium: '中（1万〜10万円）', large: '大（10万円以上）' };
export const coinTier = amount => (amount >= 100000 ? 'large' : amount >= 10000 ? 'medium' : 'small');
// 試聴用：段階と種類を指定して鳴らす
export function coin(tier, variant) {
  if (!ready()) return;
  const v = { small: 0.8, medium: 0.9, large: 1 }[tier];
  COIN[tier][variant](ctx.currentTime, v);
}
// 売れたとき（amount＝売上額）。お客さんが続くと鳴りすぎるので、段階ごとに間引く（大きい音を優先）
const GAP = { small: 0.09, medium: 0.22, large: 0.4 };
let lastCoin = { small: 0, medium: 0, large: 0 };
export function sold(amount) {
  if (!ready()) return;
  const t = ctx.currentTime, tier = coinTier(amount);
  if (t - lastCoin[tier] < GAP[tier] || (tier === 'small' && t - lastCoin.large < 0.3)) return;
  lastCoin[tier] = t;
  coin(tier, Math.floor(Math.random() * 3));
}
// 売り切れで何も買えなかった
let lastMiss = 0;
export function soldOut() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastMiss < 0.4) return;
  lastMiss = t;
  marimba(t, note(4, 0), 0.14, 0.25); marimba(t + 0.09, note(2, 0), 0.12, 0.35);
}
// 「高い…」と断られた（売り切れとは別の、下がる2音）
let lastRefuse = 0;
export function refused() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastRefuse < 0.45) return;
  lastRefuse = t;
  tone(sfxBus, 'triangle', hz(note(3, 0)), t, 0.14, 0.12); tone(sfxBus, 'triangle', hz(note(1, 0)), t + 0.1, 0.25, 0.1);
}
export function click() {
  if (!ready()) return;
  marimba(ctx.currentTime, note(4, 1), 0.12, 0.08);
}
export function buy() { // ドサッ（箱を置く音）＋主音の低いマリンバ
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(sfxBus, 'sine', 160, t, 0.15, 0.4, { slide: 60 });
  noise(sfxBus, t, 0.08, 0.2, { hp: 200, lp: 1500 });
  marimba(t + 0.04, note(0, -1), 0.18, 0.3);
}
// 調に合わせた短いフレーズ（音階の度数と、オクターブ）
function phrase(degs, step, oct = 1, vol = 0.22, voice = marimba) {
  if (!ready()) return;
  const t = ctx.currentTime;
  degs.forEach((d, i) => voice(t + i * step, note(d, oct), vol, step * 3));
}
export const invest = () => { phrase([0, 2, 4, 7], 0.07); setTimeout(() => ready() && bell(ctx.currentTime, note(7, 1), 0.2, 1), 280); }; // ドミソド＋チン
export const hire = () => phrase([4, 7, 9, 11, 9, 11], 0.08); // 小さなファンファーレ
export const news = () => phrase([4, 2], 0.13, 2, 0.24, (t, m, v) => bell(t, m, v, 0.9)); // ピンポン
export const levelUp = () => phrase([0, 2, 4, 7, 9, 11, 14], 0.06, 1, 0.2, (t, m, v) => bell(t, m, v, 0.8)); // キラキラ上昇
export const ad = () => phrase([4, 0, 2, 4, 7], 0.07); // 宣伝のジングル
export function short() { // ブブー（あえて調から外した警告音）
  if (!ready()) return;
  const t = ctx.currentTime, r = note(0, -1);
  [0, 0.16].forEach(dt => { tone(sfxBus, 'sawtooth', hz(r), t + dt, 0.13, 0.1); tone(sfxBus, 'sawtooth', hz(r + 1), t + dt, 0.13, 0.08); });
}
export function end(bankrupt) {
  if (bankrupt) phrase([4, 2, 0, -3], 0.22, 0, 0.22);
  else { phrase([0, 2, 4, 7, 4, 7, 11], 0.11, 1, 0.22); setTimeout(() => ready() && [0, 2, 4].forEach(d => bell(ctx.currentTime, note(d, 2), 0.14, 1.6)), 800); }
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
  setSfxTrack(key); // 効果音の調をこの曲に合わせる
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
