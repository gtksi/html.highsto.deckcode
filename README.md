# Hi!story Deck Analyzer

Hi!story のデッキコードからデッキリストを取得し、カードマスタと照合して CSV / Markdown / JSON に出力する GitHub Pages 向け静的サイトです。

## 現在の構成

- HTML / CSS / JavaScript のみ
- カードの正規化キーは `カード名｜異名`
- 収録セット違いは `cardId / productId / packId / cardNumber` 等で保持
- GitHub Actions で `main` への push 時に GitHub Pages へ自動デプロイ
- デッキコード複数入力
- CSV / Markdown / JSON 出力
- 大会結果URLの取得処理は試験実装

## 注意

ブラウザから `highsto.net` を直接 `fetch()` できるかは、先方の CORS 設定に依存します。

CORS により取得できない場合は、Cloudflare Workers 等の薄いプロキシを追加するか、別の取得方式を実装してください。

また、公式デッキコードページのHTML構造が変更された場合は `js/deck-code.js` の `parseDeckHtml()` を更新してください。

## GitHub Pages

1. このリポジトリを GitHub に作成
2. ファイルを `main` に push
3. GitHub の Settings → Pages を開く
4. Build and deployment の Source を `GitHub Actions` に設定
5. `main` への push または Actions の手動実行でデプロイ

## ローカル確認

単純な `file://` では ES Modules / fetch の制約があるため、ローカルHTTPサーバーを使います。

Python がある場合:

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` を開きます。
