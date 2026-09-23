// 起動・ゲームループ・プレイヤー操作の配線
import './style.css';
import { STEP_SEC, STOCK_VALUE, REVENUE_GOAL, BUY_N, POP, CRAFT, ADS } from './constants.js';
import { yen, cnt, esc } from './util.js';
import * as sim from './sim.js';
import { save as saveState, load } from './save.js';
import { $, buildStatic, renderUI as paintUI, toast, flashNews, modal, closeModal, bindModalBackdrop } from './ui.js';
import { initScene, drawScene, moveVisitors, addVisitor, clearVisitors } from './scene.js';
import * as sound from './audio.js';

let S = null;
let speed = 0;

const save = () => saveState(S);
const renderUI = () => {
  const r = paintUI(S, speed);
  if (r?.levelUp) { toast(`人気アップ！「${POP.names[r.stars - 1]}」に`); sound.levelUp(); }
};

// シミュレーションからの通知を画面へ反映する
const hooks = {
  sale(k, type, want, sold, origin) {
    addVisitor(k, type, want, sold, origin);
    if (sold > 0) sound.sold(sold); else sound.soldOut();
  },
  news() { flashNews(); sound.news(); },
  save,
  short(short) {
    setSpeed(0); sound.short();
    modal(`<h2>資金ショート</h2><p>月末の支払い ${yen(short.cost)} のうち、${yen(short.paid)} しか払えませんでした。</p>${S.staff.length ? '<p>給料が遅れたため、来月は職人の作業スピードが半分になります。</p>' : ''}<p class="warn">資金ショート ${S.strikes}/3回。3回で閉店です。</p><button class="mbtn big" id="ok">再開する</button>`, { noClose: true });
    $('#ok').onclick = () => { closeModal(); setSpeed(1); };
  },
  end(bankrupt) { setSpeed(0); save(); renderUI(); sound.end(bankrupt); showEnd(bankrupt); },
};

function startNew() { S = sim.newGame(); save(); clearVisitors(); }

function showEnd(bankrupt) {
  const { stock, score, rank, revenue, goal } = sim.settle(S, bankrupt);
  modal(`<h2>${bankrupt ? '閉店…' : '決算！'}</h2><p class="sub">${bankrupt ? '資金ショートが3回続き、工房を閉じることになりました。' : '1年間おつかれさまでした。'}</p>
  <table class="res"><tr><td>年商（1年の売上）</td><td>${yen(revenue)}</td></tr><tr><td>所持金</td><td>${yen(S.cash)}</td></tr><tr><td>予定収入</td><td>${yen(sim.recvTotal(S))}</td></tr><tr><td>在庫（完成品は1個${yen(STOCK_VALUE)}で評価）</td><td>${yen(stock)}</td></tr><tr><td>総資産</td><td>${yen(score)}</td></tr><tr><td>人気</td><td>Lv${sim.popStars(S)} ${POP.names[sim.popStars(S) - 1]}</td></tr><tr><td>販売数</td><td>${cnt(S.stats.sold)}個</td></tr><tr><td>売り逃し</td><td>${cnt(S.stats.missed)}個</td></tr></table>
  <p class="rank">称号：${rank}</p>${bankrupt ? '' : goal ? `<p class="rank red">★ 年商${yen(REVENUE_GOAL)} 達成！ ★</p>` : `<p class="sub" style="text-align:center">目標の年商${yen(REVENUE_GOAL)}まで あと${yen(REVENUE_GOAL - revenue)}</p>`}<button class="mbtn red big" id="again">もう一度あそぶ</button>`, { noClose: true });
  $('#again').onclick = () => { startNew(); closeModal(); renderUI(); setSpeed(1); };
}

/* ---------- 操作 ---------- */
function buy() {
  const r = sim.buy(S);
  if (!r) return;
  sound.buy();
  save(); renderUI();
  toast(`素材を${cnt(r.n)}個 仕入れた（${yen(r.cost)}）`);
}
function setColor(c) { if (!S || S.over) return; S.color = c; save(); renderUI(); }
// BGM：動いている間だけ鳴らす。年末商戦中はお祭りの曲
function syncBgm() {
  if (speed > 0 && S && !S.over) sound.playBgm(sim.inRush(S.day) ? 'rush' : 'normal');
  else sound.stopBgm();
}
function setSpeed(s) {
  speed = s;
  syncBgm();
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s));
  renderUI();
}
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const craftLine = c => `<b class="cn">${c.name}</b><span class="cs">うまさ<span class="st">${stars(c.skill)}</span>素早さ<span class="st">${stars(c.speed)}</span></span><small>${c.desc}。生産+${cnt(sim.craftRate(c))}個/週・月給${yen(c.wage)}</small>`;
function openInvest() {
  let confirmFire = null; // 「やめてもらう」は2回押しで確定
  const draw = () => {
    const up = sim.investItems(S).map(it => `<div class="row"><div class="grow">${it.name} <small>段階${it.lv}</small><br><small>${it.sub}</small></div>${it.done ? `<span class="sub">${it.done}</span>` : `<button class="mbtn orange" data-u="${it.id}" ${S.cash >= it.cost ? '' : 'disabled'}>${yen(it.cost)}</button>`}</div>`).join('');
    const mine = S.staff.map(c => `<div class="row"><div class="grow craft">${craftLine(c)}</div><button class="mbtn sm" data-fire="${c.id}">${confirmFire === c.id ? '本当に？' : 'やめてもらう'}</button></div>`).join('') || '<p class="sub">まだ誰も雇っていません</p>';
    const full = S.staff.length >= CRAFT.max;
    const pool = sim.poolCrafts(S).map(c => `<div class="row"><div class="grow craft">${craftLine(c)}</div><button class="mbtn orange" data-hire="${c.id}" ${sim.canHire(S, c) ? '' : 'disabled'}>雇う<br><small>${yen(c.fee)}</small></button></div>`).join('') || '<p class="sub">今週の求職者はもういません</p>';
    modal(`<h2>投資</h2><p class="sub">所持金 ${yen(S.cash)}／毎月の支払い ${yen(sim.monthly(S))}</p>${up}
      <h3 class="mh">職人 ${S.staff.length}/${CRAFT.max}人 <small>工房の腕前 ${sim.teamSkill(S).toFixed(1)}</small></h3>${mine}
      <h3 class="mh">今週の求職者 <small>毎週入れ替わり${full ? '／職人がいっぱいです' : ''}</small></h3>${pool}
      <p class="sub">うまさが高い職人がいると、お客さんが満足したときに人気が上がりやすくなります。素早さは作る速さです。</p>`);
    const dlg = $('#dlg');
    dlg.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { toast(sim.invest(S, b.dataset.u)); sound.invest(); save(); renderUI(); draw(); });
    dlg.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { const t = sim.hire(S, +b.dataset.hire); if (t) { toast(t); sound.hire(); save(); renderUI(); } draw(); });
    dlg.querySelectorAll('[data-fire]').forEach(b => b.onclick = () => {
      const id = +b.dataset.fire;
      if (confirmFire !== id) { confirmFire = id; sound.click(); draw(); return; }
      confirmFire = null; toast(sim.fire(S, id)); save(); renderUI(); draw();
    });
  };
  draw();
}
function openAd() {
  const draw = () => {
    const rows = Object.entries(ADS).map(([id, A]) => {
      const on = sim.activeAd(S, id);
      const left = on ? Math.ceil(on.until - S.t) : 0;
      return `<div class="row"><div class="grow">${A.name}<br><small>${A.desc}。人気がすぐ上がり（ゲージ+${Math.round(A.pop / POP.max * 100)}%）、${A.weeks}週間お客さんが${A.boost >= 1 ? `${A.boost + 1}倍` : `+${Math.round(A.boost * 100)}%`}</small></div>${on ? `<span class="sub">効果中<br>あと${left}週</span>` : `<button class="mbtn orange" data-ad="${id}" ${sim.canAd(S, id) ? '' : 'disabled'}>${yen(A.cost)}</button>`}</div>`;
    }).join('');
    modal(`<h2>宣伝</h2><p class="sub">お金で人気を買い、しばらくお客さんを呼び込みます。在庫を用意してから打ちましょう。所持金 ${yen(S.cash)}</p>${rows}`);
    $('#dlg').querySelectorAll('[data-ad]').forEach(b => b.onclick = () => {
      const t = sim.runAd(S, b.dataset.ad);
      if (t) { toast(t); sound.ad(); save(); renderUI(); }
      draw();
    });
  };
  draw();
}
function openHelp(after) {
  modal(`<h2>あそびかた</h2><div class="help"><ul>
  <li>時間は自動で流れます（1週＝約15秒、1ヶ月＝4週）。❚❚でいつでも止められます。</li>
  <li>画面下の「音」で、BGMと効果音／効果音だけ／音なしを切り替えられます。</li>
  <li><b>作る色</b>：職人全員が選んだ色のだるまを作ります。1個につき素材1つ。乾燥棚で1週間乾くと完成品になります。</li>
  <li><b>やめる</b>にすると素材を素材のまま温存できます。どの色にも使えるので、流行が読めないときの備えになります。</li>
  <li><b>販売</b>：お客さんが来て自動で売れます。ふつうのお客さんは1〜3個、土産物屋はまとめて、卸の業者は最大100個買っていきます。在庫が足りない分は売り逃し。お金が入るのは翌週です。</li>
  <li><b>人気</b>：欲しいだるまを全部買えたお客さんが増えるほど人気ゲージが伸び（Lv1〜5）、客足が増えます。売り切れで何も買えないと少し下がります。</li>
  <li><b>宣伝</b>：チラシ・SNS広告・テレビCMで、お金を払って人気を上げ、しばらくお客さんを増やせます。在庫を用意してから打ちましょう。</li>
  <li><b>職人</b>：投資メニューから雇えます（最大${CRAFT.max}人）。求職者は毎週入れ替わります。素早さが高いほどたくさん作り、うまさが高いほど人気が上がりやすくなります。どちらも高い人ほど給料も高めです。</li>
  <li><b>素材を買う</b>：1タップで${cnt(BUY_N)}個。特需の予告が出ると相場が上がり、特需中は入荷が絞られます。</li>
  <li><b>月末</b>に家賃と給料を払います。払えないと資金ショート、3回で閉店。</li>
  <li><b>季節</b>：4月は桜の観光客でピンク・あお・みどり、2月は春節の観光客であか・きんが売れます。11〜12月の年末商戦が最大の山場ですが、素材の入荷が細り職人も雇えなくなるので、10月までに在庫と素材を仕込みましょう。年が明けると客足がぱったり減るので、売れ残りに注意。3月第4週で決算です。</li>
  <li><b>できごと</b>：テレビ特集やSNSのバズで特定の色が売れたり、台風・原材料高騰・ホルムズ海峡封鎖（きんが作れなくなる）が起きたりします。ニュースを見逃さずに。</li>
  <li><b>きん</b>は売値が高い高級品。普段はあまり売れませんが、年末商戦と春節で人気です。</li>
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
    // 経過時間 × 速度を 0.01週刻みで進める
    const dd = sec * speed / STEP_SEC, n = Math.ceil(dd / 0.01);
    for (let i = 0; i < n && !S.over && speed > 0; i++) sim.step(S, dd / n, hooks);
    moveVisitors(sec * speed);
  }
  uiAcc += sec;
  if (uiAcc > 0.25) { uiAcc = 0; renderUI(); }
  if (uiAcc === 0) syncBgm(); // 年末商戦の始まり・終わりで曲を切り替える
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
$('#bAd').onclick = openAd;
$('#bHelp').onclick = () => openHelp();
$('#newsbar').onclick = openLog;
$('#bTitle').onclick = () => { setSpeed(0); save(); showTitle(); };
// 最初のタップで音を使えるようにする（ブラウザの制約）
document.addEventListener('pointerdown', sound.unlock, { once: true });
document.addEventListener('click', sound.unlock, { once: true });
const soundBtn = $('#bSound');
soundBtn.textContent = sound.MODE_LABEL[sound.getMode()];
soundBtn.onclick = () => {
  sound.unlock();
  const m = sound.MODES[(sound.MODES.indexOf(sound.getMode()) + 1) % sound.MODES.length];
  sound.setMode(m); soundBtn.textContent = sound.MODE_LABEL[m]; syncBgm(); sound.click();
};
$('#tNew').onclick = () => { startNew(); $('#title').classList.remove('show'); renderUI(); setSpeed(1); };
$('#tCont').onclick = () => {
  const sv = load();
  if (sv) S = sim.isValidSave(sv) ? sim.normalize(sv) : sim.newGame();
  clearVisitors(); $('#title').classList.remove('show'); renderUI(); setSpeed(1);
};
$('#tHelp').onclick = () => { $('#title').classList.remove('show'); openHelp(showTitle); };
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over) { setSpeed(0); save(); } });

const sv = load();
S = (sv && !sv.over && sim.isValidSave(sv)) ? sim.normalize(sv) : sim.newGame();
initScene($('#scene'), $('#stage'));
showTitle(); setSpeed(0); renderUI();
requestAnimationFrame(loop);

// 開発時のデバッグ用（本番ビルドでは除去される）
if (import.meta.env.DEV) window.__daruma = { get S() { return S; }, sim, sound };
