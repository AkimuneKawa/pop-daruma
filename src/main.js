// 起動・ゲームループ・プレイヤー操作の配線
import './style.css';
import { STEP_SEC, STOCK_VALUE, REVENUE_GOAL, POP, CRAFT, ADS, PRICING, LOTS } from './constants.js';
import { yen, cnt, esc } from './util.js';
import * as sim from './sim.js';
import { save as saveState, load } from './save.js';
import { $, buildStatic, renderUI as paintUI, toast, flashNews, modal, closeModal, bindModalBackdrop } from './ui.js';
import { initScene, drawScene, moveVisitors, addVisitor, clearVisitors } from './scene.js';
import * as sound from './audio.js';
import * as ranking from './ranking.js';

let S = null;
let speed = 0;

const save = () => saveState(S);
const renderUI = () => {
  const r = paintUI(S, speed);
  if (r?.levelUp) { toast(`人気アップ！「${POP.names[r.stars - 1]}」に`); sound.levelUp(); }
};

// シミュレーションからの通知を画面へ反映する
const hooks = {
  sale(k, type, want, sold, origin, refused) {
    addVisitor(k, type, want, sold, origin, refused);
    if (sold > 0) sound.sold(sold); else sound.soldOut();
  },
  news() { flashNews(); sound.news(); },
  save,
  short(short) {
    setSpeed(0); sound.short();
    modal(`<h2>資金ショート</h2><p>月末の支払い ${yen(short.cost)} のうち、${yen(short.paid)} しか払えませんでした。</p>${S.staff.length ? '<p>給料が遅れたため、来月は職人の作業スピードが半分になります。</p>' : ''}<p class="warn">資金ショート ${S.strikes}/3回。3回で閉店です。</p><button class="mbtn big" id="ok">再開する</button>`, { noClose: true });
    $('#ok').onclick = () => { closeModal(); setSpeed(1); };
  },
  // 年次決算：その年の成績を見せてから次の年へ
  yearEnd(y) {
    setSpeed(0); sound.end(false);
    const goal = y.rev >= REVENUE_GOAL;
    modal(`<h2>${y.year}年目の決算</h2><p class="sub">${y.year}年目おつかれさまでした。${y.year + 1}年目は評判が広まってお客さんが増えますが、家賃も上がります。</p>
    <table class="res"><tr><td>年商</td><td>${yen(y.rev)}</td></tr><tr><td>販売数</td><td>${cnt(y.sold)}個</td></tr><tr><td>売り逃し</td><td>${cnt(y.missed)}個</td></tr><tr><td>「高い」と断った客</td><td>${cnt(y.refused ?? 0)}人</td></tr><tr><td>人気</td><td>Lv${y.pop} ${POP.names[y.pop - 1]}</td></tr><tr><td>所持金</td><td>${yen(S.cash)}</td></tr><tr><td>税金（来月末に納める）</td><td class="red">${yen(y.tax)}</td></tr></table>
    ${goal ? `<p class="rank red">★ 年商${yen(REVENUE_GOAL)} 達成！ ★</p>` : ''}<button class="mbtn red big" id="ok">${y.year + 1}年目へ</button>`, { noClose: true });
    $('#ok').onclick = () => { closeModal(); setSpeed(1); };
  },
  end(bankrupt) { setSpeed(0); save(); renderUI(); sound.end(bankrupt); showEnd(bankrupt); },
};

function startNew() { S = sim.newGame(); save(); clearVisitors(); }

function showEnd(bankrupt) {
  const { stock, score, rank, revenue, years, best, goal } = sim.settle(S, bankrupt);
  modal(`<h2>${bankrupt ? '閉店…' : '決算！'}</h2><p class="sub">${bankrupt ? '資金ショートが3回続き、工房を閉じることになりました。' : '3年間おつかれさまでした。'}</p>
  <table class="res">${years.map((r, i) => `<tr><td>${i + 1}年目の年商</td><td>${yen(r)}</td></tr>`).join('')}<tr><td>3年間の売上</td><td>${yen(revenue)}</td></tr><tr><td>所持金</td><td>${yen(S.cash)}</td></tr><tr><td>予定収入</td><td>${yen(sim.recvTotal(S))}</td></tr><tr><td>在庫（完成品は1個${yen(STOCK_VALUE)}で評価）</td><td>${yen(stock)}</td></tr><tr><td>総資産</td><td>${yen(score)}</td></tr><tr><td>人気</td><td>Lv${sim.popStars(S)} ${POP.names[sim.popStars(S) - 1]}</td></tr><tr><td>販売数</td><td>${cnt(S.stats.sold)}個</td></tr><tr><td>売り逃し</td><td>${cnt(S.stats.missed)}個</td></tr><tr><td>「高い」と断った客</td><td>${cnt(S.stats.refused ?? 0)}人</td></tr></table>
  <p class="rank">称号：${rank}</p>${!bankrupt && ranking.enabled() ? `<div class="entry" id="entry">${S.submitted ? '<p class="sub">ランキングに登録ずみです</p>' : `<label>ランキングに登録<input id="rName" maxlength="12" placeholder="名前（12文字まで）" value="${esc(ranking.savedName())}"></label><button class="mbtn orange" id="rSend">登録</button>`}<p class="sub" id="rMsg"></p></div>` : ''}${bankrupt ? '' : goal ? `<p class="rank red">★ 年商${yen(REVENUE_GOAL)} 達成！ ★</p>` : `<p class="sub" style="text-align:center">目標の年商${yen(REVENUE_GOAL)}まで あと${yen(REVENUE_GOAL - best)}（いちばん良かった年）</p>`}${ranking.enabled() ? '<button class="mbtn big" id="seeRank">ランキングを見る</button>' : ''}<button class="mbtn red big" id="again">もう一度あそぶ</button>`, { noClose: true });
  $('#again').onclick = () => { startNew(); closeModal(); renderUI(); setSpeed(1); };
  const back = () => showEnd(bankrupt);
  if ($('#seeRank')) $('#seeRank').onclick = () => openRanking('score', back);
  const send = $('#rSend');
  if (send) send.onclick = async () => {
    const name = ranking.cleanName($('#rName').value);
    if (!name) { $('#rMsg').textContent = '名前を入れてください'; return; }
    send.disabled = true; $('#rMsg').textContent = '登録しています…';
    try {
      const r = await ranking.submit({ name, score, best, revenue, title: rank });
      S.submitted = r.id || true; save();
      sound.levelUp();
      $('#entry').innerHTML = `<p class="rank red">総資産 ${r.rank.score ?? '-'}位／最高の年商 ${r.rank.best_year ?? '-'}位</p>`;
    } catch (e) {
      send.disabled = false; $('#rMsg').textContent = e.message;
    }
  };
}
// ランキング画面。kind＝並べ方（score／best_year）、after＝とじたあとに戻る画面
async function openRanking(kind = 'score', after) {
  const tabs = Object.entries(ranking.KINDS).map(([k, label]) => `<button class="tab${k === kind ? ' on' : ''}" data-kind="${k}">${label}</button>`).join('');
  const frame = body => modal(`<h2>ランキング</h2><div class="tabs">${tabs}</div><div class="rank-list">${body}</div><button class="mbtn big" id="rClose">とじる</button>`, { noClose: true });
  const wire = () => {
    $('#dlg').querySelectorAll('[data-kind]').forEach(b => b.onclick = () => openRanking(b.dataset.kind, after));
    $('#rClose').onclick = () => { closeModal(); after?.(); };
  };
  frame('<p class="sub">読み込み中…</p>'); wire();
  try {
    const rows = await ranking.top(kind);
    const mine = S.submitted;
    const body = rows.length ? `<ol>${rows.map((r, i) => `<li class="${r.id === mine ? 'me' : ''}"><span class="no">${i + 1}</span><span class="nm">${esc(r.name)}<small>${esc(r.title)}</small></span><b>${yen(r[kind])}</b></li>`).join('')}</ol>` : '<p class="sub">まだ誰も登録していません。一番乗りを目指そう！</p>';
    frame(body); wire();
  } catch (e) {
    frame(`<p class="sub">ランキングを読み込めませんでした（${esc(e.message)}）</p>`); wire();
  }
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
// ゲームの進み。0＝止める（決算・資金ショート・タイトル・タブを離れたとき）、1＝進める
function setSpeed(s) {
  speed = s;
  syncBgm();
  renderUI();
}
// 経営メニュー：売値と1回の仕入れ量
function openMgmt() {
  const pct = x => `${Math.round(x * 100)}%`;
  const draw = () => {
    const jp = sim.refuseRate(S, 1, 'jp'), fo = sim.refuseRate(S, 1, 'west'), draw_ = sim.priceDraw(S);
    const lots = LOTS.map(([n, m]) => `<button class="mbtn${n === S.lot ? ' on' : ''}" data-lot="${n}">${cnt(n)}個<small>1個 ${yen(sim.lotPrice(S, n))}${m < 1 ? `（${Math.round((1 - m) * 100)}%引き）` : m > 1 ? `（${Math.round((m - 1) * 100)}%高い）` : ''}</small></button>`).join('');
    modal(`<h2>経営</h2>
      <h3 class="mh">だるまの売値 <small>${yen(PRICING.min)}〜${yen(PRICING.max)}</small></h3>
      <div class="pricebox"><button class="mbtn" data-p="-1" ${S.price <= PRICING.min ? 'disabled' : ''}>−</button><b>${yen(S.price)}</b><button class="mbtn" data-p="1" ${S.price >= PRICING.max ? 'disabled' : ''}>＋</button></div>
      <p class="sub">いまの目安：日本のお客さんの <b class="red">${pct(jp)}</b>、海外のお客さんの <b class="red">${pct(fo)}</b>、まとめ買いの小売店の <b class="red">${pct(sim.refuseRate(S, 1, 'jp', 'shop'))}</b>、卸の業者の <b class="red">${pct(sim.refuseRate(S, 1, 'jp', 'trader'))}</b> が「高い」と言って帰ります（年末商戦や特需の時期は、高くても買ってもらいやすくなります）。安くするほど評判が広がって客足が増えます（いまは×${draw_.toFixed(2)}）。うまい職人がいると、高くても買ってもらえます。きんは売値の1.6倍です。</p>
      <h3 class="mh">1回に仕入れる素材の量 <small>まとめ買いほど安い</small></h3>
      <div class="lots">${lots}</div>
      <p class="sub">倉庫に入りきらない量や、お金が足りない量は買えません。</p>
      <button class="mbtn big" id="mOk">とじる</button>`);
    $('#dlg').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sim.setPrice(S, S.price + PRICING.step * +b.dataset.p); sound.click(); save(); renderUI(); draw(); });
    $('#dlg').querySelectorAll('[data-lot]').forEach(b => b.onclick = () => { S.lot = +b.dataset.lot; sound.click(); save(); renderUI(); draw(); });
    $('#mOk').onclick = closeModal;
  };
  draw();
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
      <p class="sub">うまさが高い職人がいると、高い値段でも「高い」と言われにくくなります（工房の腕前）。素早さは作る速さです。</p>`);
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
  <li>時間は自動で流れます（1週＝約15秒、1ヶ月＝4週）。</li>
  <li>画面下の「音」で、BGMと効果音／効果音だけ／音なしを切り替えられます。</li>
  <li><b>作る色</b>：職人全員が選んだ色のだるまを作ります。1個につき素材1つ。乾燥棚で1週間乾くと完成品になります。</li>
  <li><b>やめる</b>にすると素材を素材のまま温存できます。どの色にも使えるので、流行が読めないときの備えになります。</li>
  <li><b>販売</b>：お客さんが来て自動で売れます。ふつうのお客さんは1〜3個、土産物屋はまとめて、卸の業者は最大100個買っていきます。在庫が足りない分は売り逃し。お金が入るのは翌週です。</li>
  <li><b>人気</b>：欲しいだるまを全部買えたお客さんが増えるほど人気ゲージが伸び（Lv1〜5）、客足が増えます。売り切れで何も買えないと少し下がります。</li>
  <li><b>宣伝</b>：チラシ・SNS広告・テレビCMで、お金を払って人気を上げ、しばらくお客さんを増やせます。在庫を用意してから打ちましょう。</li>
  <li><b>職人</b>：投資メニューから雇えます（最大${CRAFT.max}人）。求職者は毎週入れ替わります。素早さが高いほどたくさん作り、うまさが高いほど高い値段でも買ってもらえます。どちらも高い人ほど給料も高めです。</li>
  <li><b>経営</b>：だるまの売値と、1回に仕入れる素材の量を決めます。高く売るほど「高い」と言って帰るお客さんが増え（人気も少し下がる）、安く売るほど評判が広がってお客さんが増えます。海外のお客さんは値段をあまり気にしませんが、まとめ買いの小売店や業者は国籍に関係なく値段にとても敏感です。うまい職人がいると高くても買ってもらえます。素材はまとめ買いほど安くなります。</li>
  <li><b>素材を買う</b>：1タップで経営で決めた量を買います（倉庫に入らない・お金が足りないときは買えません）。素材の値段はだるまの売値の半分ほどで、相場は毎週上下します。「安値」の週に倉庫いっぱい買いだめし、「高騰」の週は控えるのがコツ。特需の予告や年末商戦の前は相場が上がり、入荷も絞られます。</li>
  <li><b>月末</b>に家賃と給料を払います。払えないと資金ショート、3回で閉店。</li>
  <li><b>税金と突発の出費</b>：毎年の決算で利益の30%の税金が決まり、翌月末に払います。年に一度、機械の故障などで修理代もかかります（設備が大きいほど高い）。支払い欄が赤いときは、いつもより多く払う月です。お金は残しておきましょう。</li>
  <li><b>季節</b>：4月は桜の観光客でピンク・あお・みどり、2月は春節の観光客であか・きんが売れます。11〜12月の年末商戦が最大の山場ですが、素材の入荷が細り職人も雇えなくなるので、10月までに在庫と素材を仕込みましょう。年が明けると客足がぱったり減るので、売れ残りに注意。毎年3月末に決算があり、3年目の終わりで最終決算です。年を追うごとにお客さんが増えますが、家賃も上がります。</li>
  <li><b>できごと</b>：テレビ特集やSNSのバズで特定の色が売れたり、台風・原材料高騰・ホルムズ海峡封鎖（きんが作れなくなる）が起きたりします。ニュースを見逃さずに。</li>
  <li><b>きん</b>は売値が高い高級品。普段はあまり売れませんが、年末商戦と春節で人気です。</li>
  <li>腕に覚えがあれば、<b>年商${yen(REVENUE_GOAL)}</b>を目指そう。</li></ul></div>
  <button class="mbtn big" id="ok">とじる</button>`);
  $('#ok').onclick = () => { closeModal(); if (after) after(); };
}
function openLog() {
  modal(`<h2>ニュースの履歴</h2><p class="sub">今年の年商 ${yen(S.year.rev)}（目標 ${yen(REVENUE_GOAL)}）</p><div class="log">${S.news.slice(0, 20).map(n => `<p>${esc(n.t)}</p>`).join('') || '<p>まだありません</p>'}</div>`);
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
$('#bBuy').onclick = buy;
$('#bInvest').onclick = openInvest;
$('#bAd').onclick = openAd;
$('#bMgmt').onclick = openMgmt;
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
$('#tRank').onclick = () => { $('#title').classList.remove('show'); openRanking('score', showTitle); };
if (!ranking.enabled()) $('#tRank').style.display = 'none';
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over) { setSpeed(0); save(); } });

const sv = load();
S = (sv && !sv.over && sim.isValidSave(sv)) ? sim.normalize(sv) : sim.newGame();
initScene($('#scene'), $('#stage'));
showTitle(); setSpeed(0); renderUI();
requestAnimationFrame(loop);

// 開発時のデバッグ用（本番ビルドでは除去される）
if (import.meta.env.DEV) window.__daruma = { get S() { return S; }, sim, sound };
