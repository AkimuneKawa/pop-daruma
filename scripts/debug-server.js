// ブランチを切り替えてテストプレイするためのランチャー。
// 使い方: npm run debug → http://localhost:5180 を開き、遊びたいブランチを選ぶ。
// 選んだブランチは .debug/worktrees/ に取り出して（git worktree）ビルドし、/play/<ブランチ>/ で配信する。
// いまの作業フォルダには触らない。ランキング（Supabase）にはつながない。デバッグパネル入りでビルドする
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, '.debug');
const PORT = Number(process.env.PORT) || 5180;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safe = name => name.replace(/[^A-Za-z0-9._-]/g, '_'); // フォルダ名用

// 手元と GitHub のブランチ（同じ名前は手元を優先）
function branches() {
  try { git('fetch', '--quiet', 'origin'); } catch (e) { /* オフラインでも手元のブランチは出す */ }
  const rows = git('for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(objectname:short)\t%(committerdate:short)\t%(subject)', 'refs/heads', 'refs/remotes/origin')
    .split('\n').filter(Boolean).map(l => { const [ref, sha, date, subject] = l.split('\t'); return { ref, sha, date, subject }; });
  const seen = new Map();
  for (const r of rows) {
    const name = r.ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/origin\//, '');
    if (name === 'HEAD' || seen.has(name)) continue;
    seen.set(name, { name, ...r, version: versionOf(r.ref) });
  }
  const order = n => n === 'main' ? 0 : n === 'dev' ? 1 : n.startsWith('feature/') ? 2 : 3;
  return [...seen.values()].sort((a, b) => order(a.name) - order(b.name) || (a.name.startsWith('release/') && b.name.startsWith('release/') ? b.name.localeCompare(a.name, 'en', { numeric: true }) : 0));
}
function versionOf(ref) {
  try { return (git('show', `${ref}:src/changelog.js`).match(/version: '([\d.]+)'/) || [])[1] || ''; } catch (e) { return ''; }
}
// ブランチ名 → 実在する ref（手元優先、なければ origin/）
function resolve(name) {
  if (!/^[A-Za-z0-9._\/-]+$/.test(name) || name.includes('..')) return null;
  for (const ref of [`refs/heads/${name}`, `refs/remotes/origin/${name}`]) {
    try { return { ref, sha: git('rev-parse', '--verify', `${ref}^{commit}`) }; } catch (e) { /* 次を試す */ }
  }
  return null;
}

// ブランチを取り出してビルドする（前回と同じコミットならビルドし直さない）
function build(name) {
  const r = resolve(name);
  if (!r) throw Object.assign(new Error(`ブランチ ${name} が見つかりません`), { status: 404 });
  const dir = path.join(WORK, 'worktrees', safe(name)), out = path.join(WORK, 'builds', safe(name)), stamp = path.join(out, '.sha');
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === r.sha) return out;
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (!fs.existsSync(dir)) { git('worktree', 'prune'); git('worktree', 'add', '--detach', dir, r.sha); }
  else execFileSync('git', ['checkout', '--quiet', '--detach', '--force', r.sha], { cwd: dir });
  // 依存パッケージはこのフォルダのものを使い回す
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(path.join(ROOT, 'node_modules'), nm, 'dir');
  console.log(`[debug] ${name}（${r.sha.slice(0, 7)}）をビルドしています…`);
  const env = { ...process.env, VITE_DEBUG: '1', VITE_BRANCH: name, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'vite'), ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn'], { cwd: dir, env, stdio: 'inherit' });
  fs.writeFileSync(stamp, r.sha);
  return out;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

function listPage() {
  const rows = branches().map(b => `<tr><td><a href="/play/${encodeURI(b.name)}/">${esc(b.name)}</a></td><td>${b.version ? `ver ${esc(b.version)}` : ''}</td><td>${esc(b.date)}</td><td><code>${esc(b.sha)}</code> ${esc(b.subject)}</td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>だるま堂 デバッグ</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#fbf1dc;color:#2a2320}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #cdbfa5;padding:6px;text-align:left;vertical-align:top}a{color:#d8382a;font-weight:bold}code{background:#eadcbc;padding:0 3px}</style>
<h1>ポップだるま堂 デバッグ：ブランチを選んで遊ぶ</h1>
<p>ブランチ名を押すと、そのブランチを取り出してビルドし、遊べる状態で開きます（初回は数秒かかります）。いまの作業フォルダには影響しません。ランキングにはつながりません。<br>
いま作業中のコードは <code>npm run dev</code>（<a href="http://localhost:5173">http://localhost:5173</a>）で遊べます。</p>
<table><tr><th>ブランチ</th><th>版</th><th>更新日</th><th>最新のコミット</th></tr>${rows}</table>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(listPage()); }
    const m = url.pathname.match(/^\/play\/(.+?)\/(.*)$/);
    // /play/<ブランチ>/<ファイル>。ブランチ名に / を含むので、index.html か assets/ の手前までをブランチ名とみなす
    if (m) {
      const full = decodeURIComponent(m[1] + '/' + m[2]);
      const cut = full.search(/\/(assets\/.*|index\.html|[^/]+\.(?:js|css|png|svg|ico|json))$/);
      const name = cut >= 0 ? full.slice(0, cut) : full.replace(/\/$/, '');
      const rest = cut >= 0 ? full.slice(cut + 1) : 'index.html';
      const out = build(name);
      const file = path.join(out, rest);
      if (!file.startsWith(out) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    if (url.pathname.startsWith('/play/')) { res.writeHead(302, { location: url.pathname + '/' }); return res.end(); }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    if (e.status !== 404) console.error(e);
    res.writeHead(e.status || 500, { 'content-type': 'text/plain; charset=utf-8' }); res.end(e.status === 404 ? e.message : `ビルドできませんでした：${e.message}`);
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`[debug] ブランチ切り替えランチャー：http://localhost:${PORT}`));
