# X の仕様が変わったときの直し方

ブクマ画面に「X の仕様が変わったようです」と出たり、取り込み件数が増えなくなったら、読み取り係（`src/x/parse.ts`）を直す。

## 1. 今の X の返事を保存する

1. `npm run dev` で開発版を動かす（開発版の拡張を Chrome に読み込む）
2. x.com を開き、DevTools のコンソールで `localStorage.setItem("twittana:dump", "1")` を実行して再読み込み
3. ブックマーク画面を開くと、コンソールに `[twittana:raw] Bookmarks {...}` が出る。JSON 部分をコピーして、リポジトリの外（例: デスクトップ）に `raw.json` として保存する
4. 終わったら `localStorage.removeItem("twittana:dump")`

## 2. 匿名化してテスト用データにする

```bash
npm run anonymize -- ~/Desktop/raw.json src/x/__fixtures__/bookmarks-YYYYMMDD.json
```

出力を開き、本文・名前・URL・ID が残っていないか目でも確かめる。**匿名化前の raw.json は絶対にコミットしない。**

## 3. テストを足して直す

`src/x/parse.test.ts` に、保存した JSON を `extractPosts(json, "bookmarks")` にかけて件数と各項目が埋まることを確かめるテストを足し、通るように `src/x/parse.ts` を直す。
