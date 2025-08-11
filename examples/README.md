# examples

実行前にルートでビルドしておく：

```sh
pnpm i
pnpm build
```

## 1) basic-redact.mjs
コア＋JP/USプラグインでマスク。

```sh
node examples/basic-redact.mjs
```

## 2) tokenize.mjs
HMACベースの決定論トークナイズ例。

```sh
node examples/tokenize.mjs
```

## 3) detect-dump.mjs
検出ヒット一覧をダンプ。

```sh
node examples/detect-dump.mjs
```


---

## 4) stream-redact.mjs
WHATWG Streamsでチャンク跨ぎ対応のストリーム赤入れ。ファイルを読み込んでマスクし、stdoutへ出力。

```sh
# サンプルテキストで流す
node examples/detect-dump.mjs

# ファイルを流す（例: input.txt を作ってから）
node examples/stream-redact.mjs input.txt > redacted.txt
```

## 5) security-demo.mjs
セキュリティプラグインでHTTPヘッダー、JWT、APIキー、Cookieなどのマスク例。

```sh
node examples/security-demo.mjs
```

## 6) dictionary-demo.mjs
カスタム辞書機能のデモ。企業固有のPIIパターン（社員ID、プロジェクトコード、製品コードなど）を辞書で定義し、ETagベースのホットリロード機能を実演。

```sh
node examples/dictionary-demo.mjs
```

辞書ファイルのサンプルは `examples/dictionary-files/` に含まれている：
- `manifest.json` - 辞書一覧
- `policy.json` - マスキングルール設定
- `company-dict.json` - 社員ID、プロジェクトコード等
- `product-dict.json` - 製品コード、SKU等  
- `financial-dict.json` - 口座番号、顧客ID等

## 7) hono-server.mjs
Honoで `/redact` エンドポイントを立て、POST本文をストリームで赤入れして返す。

事前に依存を入れる：
```sh
pnpm add hono @hono/node-server
```

起動：
```sh
node examples/hono-server.mjs
# 別ターミナルから
curl -sS http://localhost:8787/redact -X POST --data-binary @examples/basic-sample.txt
```
