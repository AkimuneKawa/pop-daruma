# ポップだるま堂 繁盛記

スマホ縦画面・1画面完結のリアルタイム工房経営シミュレーション（昭和レトロな町のだるま工房）。
仕様の詳細・経緯は `docs/HANDOFF.md` を参照（ゲーム仕様＝第3章、UI＝第4章、シーン描画＝第5章）。

## 守るべき原則
- **スクロールなしで1画面に収めること**（最重要）。390×844 と 375×667 で必ず確認する
- 操作は4種類だけ：作る色・素材を買う・投資・速度
- ミニゲームや品質の概念は入れない（意図的に廃止済み）
- トーンは昭和レトロポップ × SFC風ドット絵。作る色は全職人共通で1色

## コマンド
- `npm run dev` 開発サーバー（http://localhost:5173）
- `npm test` ユニットテスト＋自動プレイのバランス検証（vitest）
- `npm run autoplay -- 100` 自動プレイの統計を表示
- `npm run e2e` Playwright で2サイズのはみ出しチェック。スクショは `e2e/screenshots/`
- `npm run build` 本番ビルド（`dist/`、相対パスなのでどこに置いても動く）

## 構成
| ファイル | 役割 |
|---|---|
| `src/constants.js` | バランス調整値（`MM, BASE, MAT, STAFF, RACK_UP, WH_UP` など） |
| `src/sim.js` | シミュレーション本体。**DOM 非依存**。状態 `S` を引数で受け取り、画面への通知は `hooks`（sale/news/save/short/end）で行う。乱数は `rng` 引数で差し替え可 |
| `src/ui.js` | パネル表示（`renderUI`）、モーダル、トースト |
| `src/scene.js` | 工房シーンの canvas 描画と来客の動き |
| `src/sprites.js` | ドット絵データ（文字列配列）と `spr` / `darPal` |
| `src/save.js` | localStorage のセーブ／ロード |
| `src/main.js` | 起動、ゲームループ、操作ダイアログの配線 |
| `scripts/autoplay.js` | 自動プレイ（投資なし `passive`／投資あり `active`） |
| `legacy/pop-daruma.html` | 移植元の単一HTML（見た目・挙動の比較用。編集しない） |

## 注意
- UI の寸法はすべて rem（ルート font-size は `clamp(9px, min(1.72dvh, 3.05vw), 16px)`）。px を持ち込まない
- セーブキーは `popdaruma_rt_v1`。`S` の構造を変えるときはキーを上げるか変換処理を `save.js` に追加する
- 色キー `sky` は表示名が「あお」でもセーブ互換のため変えない
- バランスを変えたら `npm run autoplay` で「投資なし＝一人前（販売約165個）」「投資あり＝名工前後」を確認する
- 見た目を変えたら `npm run e2e` を実行し、スクショを目で確認する

## デプロイ
- 公開URL：https://akimunekawa.github.io/pop-daruma/ （GitHub Pages）
- `main` に push すると `.github/workflows/deploy.yml` がテスト→ビルド→公開まで自動で行う。テストが落ちたら公開されない
