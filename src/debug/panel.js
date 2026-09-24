// デバッグパネル（手元の npm run dev と、npm run debug で作ったビルドのときだけ読み込まれる）。
// 画面左の「DEBUG」タブから開く。ジャンプ・パラメータ・状態・テンプレ・ブランチの5つのタブ
import { CK, COLORS, TOTAL, YEAR } from '../constants.js';
import { yen, fullDateStr, esc } from '../util.js';
import * as sim from '../sim.js';
import { STRATEGIES } from '../strategies.js';
import { PARAMS, PRESETS, applyPreset, changedValues, isDefault, saveValues, loadValues, importValues } from './params.js';
import { JUMPS, jumpTo, fastForward } from './jump.js';

const CSS = `
#dbgTab{position:fixed;left:0;top:38%;z-index:40;writing-mode:vertical-rl;font:12px/1 monospace;letter-spacing:.1em;padding:8px 4px;background:#2a2320;color:#fbe38a;border:2px solid #fbe38a;border-left:none;cursor:pointer;opacity:.85}
#dbgTab.changed{background:#d8382a;color:#fff6e6}
#dbg{position:fixed;inset:0 auto 0 0;z-index:41;width:min(440px,100vw);background:#fbf1dc;color:#2a2320;border-right:3px solid #2a2320;box-shadow:6px 0 0 rgba(0,0,0,.25);display:flex;flex-direction:column;font:13px/1.4 system-ui,sans-serif;padding-top:env(safe-area-inset-top,0px)}
#dbg[hidden]{display:none}
#dbg header{display:flex;align-items:center;gap:6px;padding:8px;background:#2a2320;color:#fbe38a}
#dbg header b{flex:1;font:bold 14px monospace}
#dbg button{font:inherit;cursor:pointer;border:2px solid #2a2320;background:#fff6e6;color:#2a2320;padding:4px 8px}
#dbg button.on,#dbg button.pri{background:#f5c742}
#dbg header button{border-color:#fbe38a;background:#2a2320;color:#fbe38a}
#dbg nav{display:flex;border-bottom:3px solid #2a2320}
#dbg nav button{flex:1;border:none;border-right:2px solid #2a2320;padding:8px 2px;background:#eadcbc}
#dbg nav button.on{background:#fbf1dc;font-weight:bold}
#dbg .body{flex:1;overflow:auto;padding:10px}
#dbg h4{margin:12px 0 4px;font-size:13px;border-bottom:2px solid #2a2320}
#dbg .row{display:flex;align-items:center;gap:6px;margin:4px 0}
#dbg .row label{flex:1}
#dbg input[type=number],#dbg input[type=text],#dbg select,#dbg textarea{font:inherit;padding:3px 5px;border:2px solid #2a2320;background:#fff;color:#2a2320}
#dbg input[type=number]{width:8.5em;text-align:right}
#dbg input.changed{background:#fbe38a}
#dbg textarea{width:100%;height:9em;font-family:monospace;font-size:12px}
#dbg .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#dbg .card{border:2px solid #2a2320;background:#fff6e6;padding:6px;text-align:left}
#dbg .card small{display:block;color:#7a6650}
#dbg .msg{margin:6px 0;padding:6px;background:#2a2320;color:#fbe38a;white-space:pre-wrap}
#dbg .msg:empty{display:none}
#dbg .note{color:#7a6650;font-size:12px}
#dbg code{background:#eadcbc;padding:0 3px}
`;

let game, root, tab = 'jump', msg = '';
const $ = s => root.querySelector(s);

// game：{ getS, setS(S), refresh(), paused(), setPaused(bool) }（main.js から渡す）
export function initDebug(g) {
  game = g;
  const saved = loadValues(); // 前回のパラメータを引き継ぐ
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const btn = document.createElement('button'); btn.id = 'dbgTab'; btn.textContent = 'DEBUG'; btn.title = 'デバッグパネル';
  root = document.createElement('div'); root.id = 'dbg'; root.hidden = true;
  document.body.append(btn, root);
  btn.onclick = () => { root.hidden = !root.hidden; if (!root.hidden) draw(); };
  markTab();
  if (Object.keys(saved).length) console.info('[debug] 保存していたパラメータを読み込みました', saved);
}

function markTab() { document.getElementById('dbgTab').classList.toggle('changed', !isDefault()); }
// 何かいじったゲームはデバッグプレイとして印を付ける（ランキングに登録できない）
function touched() { const S = game.getS(); if (S) S.debug = true; }
function say(t) { msg = t; }

function draw() {
  const S = game.getS();
  const tabs = { jump: 'ジャンプ', params: 'パラメータ', state: '状態', presets: 'テンプレ', branch: 'ブランチ' };
  root.innerHTML = `<header><b>DEBUG</b><button id="dPause">${game.paused() ? '▶ 再開' : '❚❚ 止める'}</button><button id="dClose">×</button></header>
    <nav>${Object.entries(tabs).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</nav>
    <div class="body"><div class="msg">${esc(msg)}</div>${S ? `<p class="note">いま：${fullDateStr(sim.curDay(S))}（${Math.floor(S.t)}週目）／所持金 ${yen(S.cash)}${S.debug ? '／デバッグプレイ中（ランキング登録なし）' : ''}</p>` : ''}${BODY[tab]()}</div>`;
  $('#dClose').onclick = () => { root.hidden = true; };
  $('#dPause').onclick = () => { game.setPaused(!game.paused()); draw(); };
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; msg = ''; draw(); });
  WIRE[tab]?.();
}

const strategySelect = () => `<select id="dStrat">${Object.entries(STRATEGIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>`;

const BODY = {
  jump: () => `<p class="note">新しいゲームを、選んだ戦略の自動プレイでその週まで早送りして飛びます（職人や設備もそろった状態）。</p>
    <div class="row"><label>早送りに使う戦略</label>${strategySelect()}</div>
    <div class="grid">${JUMPS.map(j => `<button class="card" data-jump="${j.week}"><b>${j.name}</b><small>${j.desc}</small></button>`).join('')}</div>
    <h4>好きな週へ</h4>
    <div class="row"><label>週（0〜${TOTAL - 1}。1年＝${YEAR}週）</label><input type="number" id="dWeek" min="0" max="${TOTAL - 1}" value="60"><button id="dGo">飛ぶ</button></div>
    <h4>今のゲームを早送り</h4>
    <div class="row"><label>週数</label><input type="number" id="dFf" min="1" max="${TOTAL}" value="4"><button id="dFfGo">早送り</button></div>`,
  params: () => {
    let group = '';
    return `<p class="note">変えるとすぐゲームに効きます（開店資金は「はじめから」で効く）。黄色は標準から変えた値。変えた値はこのブラウザに保存されます。</p>` +
      PARAMS.map(p => {
        const head = p.group !== group ? `<h4>${(group = p.group)}</h4>` : '';
        const changed = p.key in changedValues();
        return `${head}<div class="row"><label for="p-${p.key}">${p.label}</label><input type="number" id="p-${p.key}" data-key="${p.key}" step="${p.step}" value="${p.get()}" class="${changed ? 'changed' : ''}"></div>`;
      }).join('') + `<div class="row" style="margin-top:10px"><button id="dReset">すべて標準に戻す</button></div>`;
  },
  state: () => {
    const S = game.getS();
    if (!S) return '<p>ゲームが始まっていません</p>';
    const f = (id, label, v, step = 1) => `<div class="row"><label for="s-${id}">${label}</label><input type="number" id="s-${id}" value="${v}" step="${step}"></div>`;
    return `<p class="note">いまのゲームの状態を直接書き換えます。</p>
      ${f('cash', '所持金（円）', S.cash, 10000)}${f('pop', `人気ポイント（最大 ${sim.popRatio(S) >= 1 ? '到達' : ''}）`, Math.round(S.pop), 10)}${f('price', '売値（円）', S.price, 250)}
      ${f('mat', '素材（個）', S.mat, 100)}${CK.map(k => f(`fin-${k}`, `在庫：${COLORS[k].name}`, S.fin[k], 10)).join('')}
      ${f('rackLv', '乾燥棚の段階', S.rackLv)}${f('whLv', '倉庫の段階', S.whLv)}${f('strikes', '資金ショートの回数', S.strikes)}
      ${f('week', `週（いま ${Math.floor(S.t)}）※季節やイベントの時期ごと動く`, Math.floor(S.t))}
      <div class="row"><button class="pri" id="dApply">書き換える</button></div>`;
  },
  presets: () => `<p class="note">テンプレを読み込むと、パラメータを標準に戻してからテンプレの値を入れます。</p>
    <div class="grid">${PRESETS.map(p => `<button class="card" data-preset="${p.id}"><b>${p.name}</b><small>${p.desc}</small></button>`).join('')}</div>
    <h4>書き出し・読み込み</h4>
    <p class="note">いまのパラメータ（標準から変えた値だけ）を JSON で書き出します。貼り付けて読み込むこともできます。</p>
    <textarea id="dJson">${esc(JSON.stringify(changedValues(), null, 2))}</textarea>
    <div class="row"><button id="dImport">この JSON を読み込む</button></div>`,
  branch: () => `<p>いまのブランチ：<code>${esc(BRANCH)}</code></p>
    <p class="note">ほかのブランチ（dev・feature・過去の版 release/vX.Y）を遊ぶには、ターミナルで次を実行し、表示された一覧から選びます。選んだブランチは別のフォルダに取り出してビルドするので、いまの作業には影響しません。</p>
    <p><code>npm run debug</code> → <a href="http://localhost:5180" target="_blank" rel="noopener">http://localhost:5180</a></p>
    <p class="note">ブランチ切り替えで遊ぶ版はランキングにつながりません。</p>`,
};

const WIRE = {
  jump: () => {
    const strat = () => $('#dStrat').value;
    const go = week => {
      try {
        const { S, tries } = jumpTo(week, strat());
        S.debug = true;
        game.setS(S);
        say(`${fullDateStr(sim.curDay(S))}（${Math.floor(S.t)}週目）へ飛びました（${STRATEGIES[strat()].name}${tries > 1 ? `、途中で閉店したので${tries}回目` : ''}）`);
      } catch (e) { say(e.message); }
      draw();
    };
    root.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => go(+b.dataset.jump));
    $('#dGo').onclick = () => go(Math.max(0, Math.min(TOTAL - 0.2, +$('#dWeek').value)));
    $('#dFfGo').onclick = () => {
      const S = game.getS(); if (!S || S.over) return;
      touched();
      const { bankrupt } = fastForward(S, Math.max(1, +$('#dFf').value), strat());
      game.refresh();
      say(bankrupt ? '早送りの途中で閉店しました' : `${fullDateStr(sim.curDay(S))}まで早送りしました`);
      draw();
    };
  },
  params: () => {
    root.querySelectorAll('input[data-key]').forEach(inp => inp.onchange = () => {
      const p = PARAMS.find(x => x.key === inp.dataset.key), v = Number(inp.value);
      if (!Number.isFinite(v)) return;
      p.set(v); saveValues(); touched(); markTab(); game.refresh();
      inp.classList.toggle('changed', p.key in changedValues());
    });
    $('#dReset').onclick = () => { applyPreset('standard'); saveValues(); markTab(); game.refresh(); say('すべて標準に戻しました'); draw(); };
  },
  state: () => {
    $('#dApply').onclick = () => {
      const S = game.getS(), n = id => Number($(`#s-${id}`).value);
      S.cash = n('cash'); S.pop = Math.max(0, n('pop')); sim.setPrice(S, n('price'));
      S.mat = Math.max(0, Math.round(n('mat'))); for (const k of CK) S.fin[k] = Math.max(0, Math.round(n(`fin-${k}`)));
      S.rackLv = clampLv(n('rackLv'), sim.investItems(S)[0]); S.whLv = clampLv(n('whLv'), sim.investItems(S)[1]); S.strikes = Math.max(0, Math.min(2, Math.round(n('strikes'))));
      const w = Math.max(0, Math.min(TOTAL - 1, Math.round(n('week'))));
      if (w !== Math.floor(S.t)) { const shift = w - S.t; S.t = w; S.day = w; for (const r of S.rack) r.ready += shift; for (const r of S.recv) r.due += shift; sim.updateMarket(S, true); }
      touched(); game.refresh(); say('状態を書き換えました'); draw();
    };
  },
  presets: () => {
    root.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      applyPreset(b.dataset.preset); saveValues(); if (!isDefault()) touched(); markTab(); game.refresh();
      say(`テンプレ「${PRESETS.find(p => p.id === b.dataset.preset).name}」を読み込みました`); draw();
    });
    $('#dImport').onclick = () => {
      try { const n = importValues($('#dJson').value); saveValues(); touched(); markTab(); game.refresh(); say(`${n}個の値を読み込みました`); } catch (e) { say(`読み込めませんでした：${e.message}`); }
      draw();
    };
  },
};

// 段階の上限は投資メニューの「段階 x/y」の y
function clampLv(v, item) { const max = Number(String(item.lv).split('/')[1]); return Math.max(0, Math.min(max, Math.round(v))); }

// いまのブランチ名（vite.config.js がビルド時に入れる。ランチャーのビルドは VITE_BRANCH で渡す）
const BRANCH = import.meta.env.VITE_BRANCH || (typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : '不明');
