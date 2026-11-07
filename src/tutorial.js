// 体験型のチュートリアル：画面の一部を照らして吹き出しで説明し、操作の段ではそこを実際にタップしてもらう。
// 動かしている間はゲームを止めておき（呼び出し元）、照らした所と吹き出し以外のタップは受け付けない
const KEY = 'popdaruma_tutorial_done';
export const tutorialDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
export const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* 保存できない環境 */ } };

// at＝照らす場所、tap＝実際にタップしてもらう要素（なければ「次へ」）
const STEPS = [
  { at: '#stage', text: 'ここがあなたのだるま工房。時間は自動で流れ、職人がだるまを作り、お客さんが来ると自動で売れていきます。' },
  { at: '#colors', tap: '.cbtn:not(.off)', text: '作るだるまの色をえらびます。好きな色をタップしてみよう！' },
  { at: '#bBuy', tap: '#bBuy', text: '素材がないとだるまは作れません。タップして素材を買ってみよう！' },
  { at: '.panels', text: '在庫が切れると売り逃し。欲しい分を全部買えたお客さんが多いほど人気が上がり、客足が増えます。' },
  { at: '.subbar', text: '月末には家賃と給料を払います。払えないことが3回あると閉店です。' },
  { at: '.ctrl', text: '慣れてきたら「投資」で職人を雇い、「宣伝」でお客さんを呼び、「経営」で売値を決めよう。3年でどこまで大きくできるかな？', last: true },
];

let el = null, i = 0, done = null;
const $ = s => document.querySelector(s);

// 照らした所と吹き出し以外のタップを止める。操作の段は、タップのあと少し見せてから次へ
function guard(e) {
  if (!el) return;
  if (el.box.contains(e.target)) return;
  const s = STEPS[i], hit = s.tap && e.target.closest(s.tap);
  if (hit && !hit.disabled) {
    if (!el.wait) { el.wait = true; setTimeout(() => { if (el) { el.wait = false; go(i + 1); } }, 450); }
    return;
  }
  e.preventDefault(); e.stopPropagation();
}

function place() {
  const s = STEPS[i], t = $(s.at);
  if (!el || !t) return;
  const r = t.getBoundingClientRect(), pad = 4;
  Object.assign(el.hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  // 吹き出しは照らした所の上か下の、広い方に出す
  const below = r.top + r.height / 2 < innerHeight / 2;
  el.box.style.top = below ? `${r.bottom + pad + 8}px` : '';
  el.box.style.bottom = below ? '' : `${innerHeight - r.top + pad + 8}px`;
  const tap = el.box.querySelector('.tut-tap');
  if (tap) tap.textContent = `${below ? '↑' : '↓'} タップしてね`;
}

function go(n) {
  i = n;
  if (i >= STEPS.length) return finish();
  const s = STEPS[i], btn = s.tap && $(s.tap);
  const needNext = !s.tap || !btn || btn.disabled; // 押せないときは「次へ」で進める
  el.box.innerHTML = `<p class="tut-n">${i + 1} / ${STEPS.length}</p><p>${s.text}</p><div class="tut-b"><button class="link" id="tutSkip">スキップ</button>${needNext ? `<button class="mbtn red" id="tutNext">${s.last ? 'はじめる！' : '次へ'}</button>` : '<span class="tut-tap"></span>'}</div>`;
  el.box.classList.toggle('tap', !needNext);
  $('#tutSkip').onclick = finish;
  if (needNext) $('#tutNext').onclick = () => go(i + 1);
  place();
}

function finish() {
  if (!el) return;
  markDone();
  document.removeEventListener('click', guard, true);
  removeEventListener('resize', place);
  el.root.remove(); el = null;
  document.body.classList.remove('tut-on');
  done?.();
}

export function startTutorial(onEnd) {
  if (el) return;
  done = onEnd;
  const root = document.createElement('div');
  root.className = 'tut';
  root.innerHTML = '<div class="tut-hole"></div><div class="tut-box" role="dialog" aria-label="チュートリアル"></div>';
  document.body.append(root);
  document.body.classList.add('tut-on');
  el = { root, hole: root.querySelector('.tut-hole'), box: root.querySelector('.tut-box') };
  document.addEventListener('click', guard, true);
  addEventListener('resize', place);
  go(0);
}
