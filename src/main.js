// 起動・ゲームループ・プレイヤー操作の配線
import './style.css';
import { DAY_SEC, STOCK_VALUE, REVENUE_GOAL, QTY, BUY_N } from './constants.js';
import { yen, cnt, esc } from './util.js';
import * as sim from './sim.js';
import { save as saveState, load } from './save.js';
import { $, buildStatic, renderUI as paintUI, toast, flashNews, modal, closeModal, bindModalBackdrop } from './ui.js';
import { initScene, drawScene, moveVisitors, addVisitor, clearVisitors } from './scene.js';

let S = null;
let speed = 0;

const save = () => saveState(S);
const renderUI = () => paintUI(S, speed);

// シミュレーションからの通知を画面へ反映する
const hooks = {
  // 画面に歩いてくる客は QTY 人に1人の割合で描く（買えたかどうかは売れた割合で決める）
  sale(k, sold, missed) {
    const n = sold + missed;
    if (Math.random() < n / QTY) addVisitor(k, Math.random() < sold / n);
  },
  news: flashNews,
  save,
  short(short) {
    setSpeed(0);
    modal(`<h2>資金ショート</h2><p>月末の支払い ${yen(short.cost)} のうち、${yen(short.paid)} しか払えませんでした。</p>${S.staff.length ? '<p>給料が遅れたため、来月は職人の作業スピードが半分になります。</p>' : ''}<p class="warn">資金ショート ${S.strikes}/3回。3回で閉店です。</p><button class="mbtn big" id="ok">再開する</button>`, { noClose: true });
    $('#ok').onclick = () => { closeModal(); setSpeed(1); };
  },
  end(bankrupt) { setSpeed(0); save(); renderUI(); showEnd(bankrupt); },
};

function startNew() { S = sim.newGame(); save(); clearVisitors(); }

function showEnd(bankrupt) {
  const { stock, score, rank, revenue, goal } = sim.settle(S, bankrupt);
  modal(`<h2>${bankrupt ? '閉店…' : '決算！'}</h2><p class="sub">${bankrupt ? '資金ショートが3回続き、工房を閉じることになりました。' : '1年間おつかれさまでした。'}</p>
  <table class="res"><tr><td>年商（1年の売上）</td><td>${yen(revenue)}</td></tr><tr><td>所持金</td><td>${yen(S.cash)}</td></tr><tr><td>予定収入</td><td>${yen(sim.recvTotal(S))}</td></tr><tr><td>在庫（完成品は1個${yen(STOCK_VALUE)}で評価）</td><td>${yen(stock)}</td></tr><tr><td>総資産</td><td>${yen(score)}</td></tr><tr><td>販売数</td><td>${cnt(S.stats.sold)}個</td></tr><tr><td>売り逃し</td><td>${cnt(S.stats.missed)}個</td></tr></table>
  <p class="rank">称号：${rank}</p>${bankrupt ? '' : goal ? `<p class="rank red">★ 年商${yen(REVENUE_GOAL)} 達成！ ★</p>` : `<p class="sub" style="text-align:center">目標の年商${yen(REVENUE_GOAL)}まで あと${yen(REVENUE_GOAL - revenue)}</p>`}<button class="mbtn red big" id="again">もう一度あそぶ</button>`, { noClose: true });
  $('#again').onclick = () => { startNew(); closeModal(); renderUI(); setSpeed(1); };
}

/* ---------- 操作 ---------- */
function buy() {
  const r = sim.buy(S);
  if (!r) return;
  save(); renderUI();
  toast(`素材を${cnt(r.n)}個 仕入れた（${yen(r.cost)}）`);
}
function setColor(c) { if (!S || S.over) return; S.color = c; save(); renderUI(); }
function setSpeed(s) {
  speed = s;
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s));
  renderUI();
}
function openInvest() {
  const draw = () => {
    const h = sim.investItems(S).map(it => `<div class="row"><div class="grow">${it.name}<br><small>${it.sub}</small></div>${it.done ? `<span class="sub">${it.done}</span>` : `<button class="mbtn orange" data-u="${it.id}" ${S.cash >= it.cost ? '' : 'disabled'}>${yen(it.cost)}</button>`}</div>`).join('');
    modal(`<h2>投資</h2><p class="sub">金額をタップすると購入します。所持金 ${yen(S.cash)}／毎月の支払い ${yen(sim.monthly(S))}</p>${h}`);
    $('#dlg').querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
      toast(sim.invest(S, b.dataset.u));
      save(); renderUI(); draw();
    });
  };
  draw();
}
function openHelp(after) {
  modal(`<h2>あそびかた</h2><div class="help"><ul>
  <li>時間は自動で流れます（1日＝約15秒、1ヶ月＝10日）。❚❚でいつでも止められます。</li>
  <li><b>作る色</b>：職人全員が選んだ色のだるまを作ります。1個につき素材1つ。乾燥棚で3日乾くと完成品になります。</li>
  <li><b>やめる</b>にすると素材を素材のまま温存できます。どの色にも使えるので、流行が読めないときの備えになります。</li>
  <li><b>販売</b>：お客さんが来て自動で売れます。在庫がない色は売り逃し。お金が入るのは3日後です。</li>
  <li><b>素材を買う</b>：1タップで${cnt(BUY_N)}個。特需の予告が出ると相場が上がり、特需中は入荷が絞られます。</li>
  <li><b>月末</b>に家賃と給料を払います。払えないと資金ショート、3回で閉店。</li>
  <li>12月〜1月の年末ラッシュが最大の山場。3月10日で決算です。</li>
  <li>腕に覚えがあれば、<b>年商${yen(REVENUE_GOAL)}</b>を目指そう。</li></ul></div>
  <button class="mbtn big" id="ok">とじる</button>`);
  $('#ok').onclick = () => { closeModal(); if (after) after(); };
}
function openLog() {
  modal(`<h2>ニュースの履歴</h2><p class="sub">ここまでの年商 ${yen(S.stats.rev)}（目標 ${yen(REVENUE_GOAL)}）</p><div class="log">${S.news.slice(0, 20).map(n => `<p>${esc(n.t)}</p>`).join('') || '<p>まだありません</p>'}</div>`);
}
function showTitle() {
  const sv = load();
  $('#tCont').style.display = (sv && !sv.over) ? 'block' : 'none';
  $('#title').classList.add('show');
}

/* ---------- ループ ---------- */
let last = 0, uiAcc = 0;
function loop(now) {
  const sec = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (S && !S.over && speed > 0) {
    // 経過時間 × 速度を 0.01日刻みで進める
    const dd = sec * speed / DAY_SEC, n = Math.ceil(dd / 0.01);
    for (let i = 0; i < n && !S.over && speed > 0; i++) sim.step(S, dd / n, hooks);
    moveVisitors(sec * speed);
  }
  uiAcc += sec;
  if (uiAcc > 0.25) { uiAcc = 0; renderUI(); }
  drawScene(now, S, speed);
  requestAnimationFrame(loop);
}

/* ---------- 起動 ---------- */
buildStatic();
bindModalBackdrop();
document.querySelectorAll('.cbtn').forEach(b => b.onclick = () => setColor(b.dataset.c));
document.querySelectorAll('.spd').forEach(b => b.onclick = () => { if (S && !S.over) setSpeed(+b.dataset.s); });
$('#bBuy').onclick = buy;
$('#bInvest').onclick = openInvest;
$('#bHelp').onclick = () => openHelp();
$('#newsbar').onclick = openLog;
$('#bTitle').onclick = () => { setSpeed(0); save(); showTitle(); };
$('#tNew').onclick = () => { startNew(); $('#title').classList.remove('show'); renderUI(); setSpeed(1); };
$('#tCont').onclick = () => {
  const sv = load();
  if (sv) S = sim.isValidSave(sv) ? sv : sim.newGame();
  clearVisitors(); $('#title').classList.remove('show'); renderUI(); setSpeed(1);
};
$('#tHelp').onclick = () => { $('#title').classList.remove('show'); openHelp(showTitle); };
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over) { setSpeed(0); save(); } });

const sv = load();
S = (sv && !sv.over && sim.isValidSave(sv)) ? sv : sim.newGame();
initScene($('#scene'), $('#stage'));
showTitle(); setSpeed(0); renderUI();
requestAnimationFrame(loop);

// 開発時のデバッグ用（本番ビルドでは除去される）
if (import.meta.env.DEV) window.__daruma = { get S() { return S; }, sim };
