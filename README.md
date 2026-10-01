# ツイッ棚（TwitTana）

Twitter（現 X）のブックマークを、自分で作ったフォルダに振り分けて見返すための Chrome 拡張。

- X Premium 不要（無料アカウントで使える）
- ブックマークのデータはすべて自分の PC（ブラウザ内）に保存し、外部サーバーには送らない

> X Corp. とは関係のない非公式ツールです。

## 開発

```bash
npm install
npm run build
```

1. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにする
2. 「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3` を選ぶ
3. コードを変えたら `npm run build` し直し、拡張機能の画面で「更新」を押す（`npm run dev` なら自動で読み直す）

テスト: `npm test` / 型チェック: `npm run typecheck` / lint: `npm run lint`

テストや型チェックが `.wxt/tsconfig.json` が無いと言って落ちるときは、`npx wxt prepare` を一度実行する。

アイコンを描き直したら `npm run icons`。X の仕様が変わったときは [`docs/maintenance.md`](./docs/maintenance.md)。

## 状態

第1弾を実装済み（公開前の確認中）。決まったことと次の作業は [`task.md`](./task.md)、守る制約は [`AGENTS.md`](./AGENTS.md)。
