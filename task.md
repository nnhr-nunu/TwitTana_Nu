# ツイッ棚 タスク一覧（未完了のみ）

完了の詳細は `git log`。制約は [`AGENTS.md`](./AGENTS.md)。設計は [`docs/superpowers/specs/2026-10-02-twittana-design.md`](./docs/superpowers/specs/2026-10-02-twittana-design.md)。

## 今やっていること（ユーザーの作業待ち）

第1弾の実装は計画1〜6で完了（`docs/superpowers/plans/`）。単体テスト・E2E（偽の X ページ）は通る。

- [ ] 手での確認（`docs/manual-test.md` の全表）。実際の X アカウントが要るのでユーザーが行う。不具合が出たらここに書く
- [ ] 実際の X の返事を匿名化してテスト用データにする（`docs/maintenance.md`）。ユーザーの X アカウントが要る

## 開発メモ

- Playwright は `~1.59.1` に固定（1.60 以降が要る Chromium は、この PC では Playwright の取得がタイムアウトした。キャッシュ済みの rev1217 で動く）。上げるときは `npx playwright install chromium` が通るか先に確かめる
- `npm run e2e` は `.output/chrome-mv3` を E2E 用（Shadow DOM を開いた状態）でビルドし直す。Chrome で使う前に `npm run build`

## あとで（第1弾に入れない）

- 第2弾: スマホ用 Web アプリ（X アプリの共有ボタン → フォルダ選択、投稿の中身は oEmbed で取得）
- 第3弾: PC とスマホの同期（Cloudflare 無料枠の見込み）
- フォルダの入れ子・メモ・色分け、画像の保存、Markdown / CSV 書き出し、Firefox 版、紹介サイトの広告

## 保留（ユーザーが決める）

- ライセンス（公開リポジトリ。付けなければ「見られるが再利用は不可」のまま）
- 寄付の受け皿（Ko-fi など）の URL
- ストア公開に使う Google アカウント（開発者登録料 5 ドル、1 回のみ）
- GitHub Pages を有効にする（リポジトリの Settings → Pages → Deploy from a branch → `main` / `/docs`）。プライバシーポリシーの URL がこれで開くようになる
- ストアに出すスクリーンショット 4 枚（`docs/store/listing.md`）
