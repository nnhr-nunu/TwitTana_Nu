# ツイッ棚 タスク一覧（未完了のみ）

完了の詳細は `git log`。制約は [`AGENTS.md`](./AGENTS.md)。設計は [`docs/superpowers/specs/2026-10-02-twittana-design.md`](./docs/superpowers/specs/2026-10-02-twittana-design.md)。

## 今やっていること

- [x] 計画1〜4（`docs/superpowers/plans/`）
- [ ] 手での確認（`docs/manual-test.md` の全表）。実際の X アカウントが要るのでユーザーが行う
- [ ] 実際の X の返事を匿名化してテスト用データにする（`docs/maintenance.md`）。ユーザーの X アカウントが要る
- [x] 計画6：見直しで見つかった不具合の修正（`docs/superpowers/plans/2026-10-02-twittana-f-review-fixes.md`）
- [ ] 計画5：本物のブラウザでのつなぎ確認（`docs/superpowers/plans/2026-10-02-twittana-e-e2e.md`）

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
