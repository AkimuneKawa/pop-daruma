// DOM の更新（パネル表示・モーダル・トースト）
import { CK, TOTAL, COLORS } from './constants.js';
import { MINI, spr, darPal, paintStatic } from './sprites.js';
import { yen, yenShort, dateStr } from './util.js';
import * as sim from './sim.js';

export const $ = s => document.querySelector(s);

// 色ボタン・在庫欄を生成してドット絵を塗る（起動時に1回）
export function buildStatic() {
  $('#colors').innerHTML = CK.map(k => `<button class="cbtn" data-c="${k}"><canvas class="dar" width="14" height="14" data-spr="${k}"></canvas>${COLORS[k].name}</button>`).join('') + `<button class="cbtn" data-c="stop"><span class="blank"></span>やめる</button>`;
  $('#stock').innerHTML = CK.map(k => `<div><canvas class="dar" width="14" height="14" data-spr="${k}"></canvas><b id="st-${k}"></b></div>`).join('');
  paintStatic(document);
}

let pipCtx = null;
export function renderUI(S, speed) {
  if (!S) return;
  pipCtx ??= $('#prodPips').getContext('2d');
  const d = sim.curDay(S);
  $('#date').textContent = dateStr(d);
  $('#left').textContent = `のこり${Math.max(0, TOTAL - S.day)}日`;
  $('#cash').textContent = yenShort(S.cash);
  $('#due').textContent = `あと${10 - (S.day % 10)}日（${yenShort(sim.monthly(S))}）`;
  $('#recv').textContent = '+' + yenShort(sim.recvTotal(S));
  $('#ptag').classList.toggle('show', speed === 0 && !S.over);
  $('#banner').textContent = S.banner || '';
  $('#mood').textContent = sim.mood(S);
  // 生産スピードのだるまピップ
  const reason = sim.prodReason(S), r = sim.prodRate(S), filled = reason ? 0 : Math.min(6, Math.round(r));
  pipCtx.clearRect(0, 0, 54, 8);
  for (let i = 0; i < 6; i++) spr(MINI, darPal(i < filled ? (S.color === 'stop' ? 'red' : S.color) : 'gray'), i * 9 + 1, 0, 1, pipCtx);
  $('#sProdTxt').textContent = reason;
  $('#prodPips').style.display = reason ? 'none' : '';
  $('#sSold').textContent = S.today.sold + '個';
  $('#sMiss').textContent = S.today.missed + '個';
  $('#sWh').textContent = `${Math.max(0, sim.whFree(S))} / ${sim.whCap(S)}`;
  const stuck = S.rack.filter(x => x.ready <= S.t).length;
  $('#sRack').innerHTML = `${sim.rackFree(S)} / ${sim.rackCap(S)}` + (stuck ? '<small class="red" style="font-size:.7rem"> 倉庫満杯</small>' : '');
  const lv = S.m < 1.1 ? 0 : S.m < 1.5 ? 1 : 2, mt = sim.marketTarget(S, S.day).t;
  for (let i = 0; i < 3; i++) $('#mk' + i).classList.toggle('on', i === lv);
  $('#sM').textContent = `×${S.m.toFixed(2)}${mt > S.m + 0.01 ? '↗' : mt < S.m - 0.01 ? '↘' : ''}`;
  for (const k of CK) $('#st-' + k).textContent = S.fin[k];
  $('#sStockTot').textContent = `素材${S.mat}`;
  document.querySelectorAll('.cbtn').forEach(b => b.classList.toggle('on', b.dataset.c === S.color));
  const n = sim.buyQty(S), bb = $('#bBuy');
  bb.disabled = S.over || n < 1;
  $('#bBuyT').innerHTML = n > 0 ? `素材を買う ×${n}<small>${yen(n * sim.matPrice(S))}</small>` : `素材を買う<small>${sim.buyBlockReason(S)}</small>`;
  $('#bInvest').disabled = S.over;
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
