// DOM の更新（パネル表示・モーダル・トースト）
import { CK, TOTAL, YEAR, WEEKS, COLORS, POP, SELF_RATE, CRAFT, MARKET_LEVELS } from './constants.js';

// 生産スピードのピップ1個あたりの生産量（素早さ★5を最大人数雇ったときにちょうど6個）
const PIP = (SELF_RATE + CRAFT.max * 5 * CRAFT.ratePerSpeed) / 6;
import { MINI, spr, darPal, paintStatic } from './sprites.js';
import { yen, cnt, dateStr, yearOf } from './util.js';
import * as sim from './sim.js';

export const $ = s => document.querySelector(s);

// 色ボタン・在庫欄を生成してドット絵を塗る（起動時に1回）
export function buildStatic() {
  $('#colors').innerHTML = CK.map(k => `<button class="cbtn" data-c="${k}"><canvas class="dar" width="14" height="14" data-spr="${k}"></canvas>${COLORS[k].name}</button>`).join('') + `<button class="cbtn" data-c="stop"><span class="blank"></span>やめる</button>`;
  $('#stock').innerHTML = CK.map(k => `<div><canvas class="dar" width="14" height="14" data-spr="${k}"></canvas><b id="st-${k}"></b></div>`).join('');
  paintStatic(document);
}

let pipCtx = null;
let lastPop = { S: null, ratio: 0, stars: 1 };
function flashGauge(g, mark, dir) {
  g.classList.remove('up', 'down'); void g.offsetWidth; g.classList.add(dir);
  mark.textContent = dir === 'up' ? '▲' : '▼'; mark.classList.toggle('dn', dir === 'down');
  clearTimeout(flashGauge.h); flashGauge.h = setTimeout(() => { mark.textContent = ''; }, 1200);
}
export function renderUI(S, speed) {
  if (!S) return;
  pipCtx ??= $('#prodPips').getContext('2d');
  const d = sim.curDay(S);
  $('#date').textContent = dateStr(d);
  $('#left').textContent = `${yearOf(d)}年目 残${YEAR - (d % YEAR)}週`; // 今年の残り
  const cashTxt = yen(S.cash), cashEl = $('#cash');
  cashEl.textContent = cashTxt;
  // 桁が増えたら文字を小さくして枠に収める（「99,999,999円」で11文字）
  cashEl.style.fontSize = cashTxt.length >= 11 ? '1.25rem' : cashTxt.length >= 10 ? '1.45rem' : '';
  $('#due').textContent = `あと${WEEKS - (S.day % WEEKS)}週`;
  $('#dueAmt').textContent = yen(sim.dueTotal(S));
  $('#dueAmt').classList.toggle('red', sim.billsTotal(S) > 0); // 税金・修理代があるときは赤
  $('#recv').textContent = '+' + yen(sim.recvTotal(S));
  $('#ptag').classList.toggle('show', speed === 0 && !S.over);
  $('#banner').textContent = S.banner || '';
  $('#mood').textContent = sim.mood(S);
  // 人気ゲージ。上がると光って▲、下がると赤く光って▼。段階（Lv1〜5）が上がったら呼び出し元に知らせる
  const ratio = sim.popRatio(S), stars = sim.popStars(S);
  $('#popFill').style.width = (ratio * 100).toFixed(1) + '%';
  $('#popLv').textContent = 'Lv' + stars;
  $('#pop').title = POP.names[stars - 1];
  const g = $('#popG'), up = $('#popUp');
  let levelUp = false;
  if (lastPop.S === S) {
    if (ratio > lastPop.ratio + 0.002) flashGauge(g, up, 'up');
    else if (ratio < lastPop.ratio - 0.002) flashGauge(g, up, 'down');
    levelUp = stars > lastPop.stars;
  }
  lastPop = { S, ratio, stars };
  $('#bAd').classList.toggle('on', S.ads.some(a => S.t < a.until));
  // 生産スピードのだるまピップ
  const reason = sim.prodReason(S), r = sim.prodRate(S), filled = reason ? 0 : Math.min(6, Math.max(1, Math.round(r / PIP)));
  pipCtx.clearRect(0, 0, 54, 8);
  for (let i = 0; i < 6; i++) spr(MINI, darPal(i < filled ? (S.color === 'stop' ? 'red' : S.color) : 'gray'), i * 9 + 1, 0, 1, pipCtx);
  $('#sProdTxt').textContent = reason;
  $('#prodPips').style.display = reason ? 'none' : '';
  $('#sSold').textContent = cnt(S.today.sold) + '個';
  $('#sMiss').textContent = cnt(S.today.missed) + '個';
  $('#sWh').textContent = `${cnt(Math.max(0, sim.whFree(S)))} / ${cnt(sim.whCap(S))}`;
  const stuck = S.rack.some(x => x.ready <= S.t);
  $('#sRack').innerHTML = `${cnt(sim.rackFree(S))} / ${cnt(sim.rackCap(S))}` + (stuck ? '<small class="red" style="font-size:.7rem"> 倉庫満杯</small>' : '');
  // 相場：安値・ふつう・高騰。矢印は季節やイベントによる流れ（毎週の揺れは読めない）
  const lv = S.m < MARKET_LEVELS[0] ? 0 : S.m < MARKET_LEVELS[1] ? 1 : 2, mt = sim.marketTarget(S, S.day).t, base = S.mBase ?? S.m;
  for (let i = 0; i < 3; i++) $('#mk' + i).classList.toggle('on', i === lv);
  $('#sM').textContent = `×${S.m.toFixed(2)}${mt > base + 0.01 ? '↗' : mt < base - 0.01 ? '↘' : ''}`;
  for (const k of CK) $('#st-' + k).textContent = cnt(S.fin[k]);
  $('#sStockTot').textContent = `素材${cnt(S.mat)}`;
  document.querySelectorAll('.cbtn').forEach(b => { b.classList.toggle('on', b.dataset.c === S.color); b.classList.toggle('off', b.dataset.c !== 'stop' && sim.colorStopped(S, b.dataset.c)); });
  // 素材ボタン：選んだ量ちょうどを買う。買えないときは理由を出す
  const why = sim.buyBlockReason(S), bb = $('#bBuy');
  bb.disabled = S.over || !!why;
  $('#bBuyT').innerHTML = `素材を買う ×${cnt(S.lot)}<small>${why || yen(sim.buyCost(S))}</small>`;
  $('#bMgmtP').textContent = yen(S.price);
  $('#bMgmt').disabled = S.over;
  $('#bInvest').disabled = S.over;
  $('#bAd').disabled = S.over;
  return { levelUp, stars };
}

export function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => el.classList.remove('show'), 1400);
}
export function flashNews() { const b = $('#newsbar'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
export function modal(html, opt = {}) {
  const d = $('#dlg');
  d.dataset.lock = opt.noClose ? '1' : '';
  d.innerHTML = (opt.noClose ? '' : '<button class="x" id="mx" aria-label="閉じる">×</button>') + html;
  $('#modal').classList.add('show');
  paintStatic(d);
  if (!opt.noClose) $('#mx').onclick = closeModal;
}
export function closeModal() { $('#modal').classList.remove('show'); }
export function bindModalBackdrop() {
  $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal' && !$('#dlg').dataset.lock) closeModal(); });
}
