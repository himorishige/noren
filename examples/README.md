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
node examples/stream-redact.mjs

# ファイルを流す（例: input.txt を作ってから）
node examples/stream-redact.mjs input.txt > redacted.txt
```

## 5) hono-server.mjs
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
