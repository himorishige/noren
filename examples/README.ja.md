# Noren サンプルコード集

`Noren`ライブラリの様々な機能やユースケースを実演するサンプルコード集です。

## 実行前の準備

すべてのサンプルを実行する前に、プロジェクトのルートディレクトリで依存パッケージのインストールとビルドを完了させてください。

```sh
# 依存パッケージのインストール
pnpm i

# 全パッケージのビルド
pnpm build
```

---

## 1. 基本的なマスキング処理 (`basic-redact.mjs`)

**概要:**
コア機能と日米プラグインを使い、テキストに含まれる個人情報（電話番号、クレジットカード番号など）を基本的なルールでマスク（`****`のような文字列に置換）します。`Noren`の最も基本的な使い方です。

**実行方法:**
```sh
node examples/basic-redact.mjs
```

## 2. HMACによるトークン化 (`tokenize.mjs`)

**概要:**
個人情報を、元の値と一対一で対応する一意なトークン文字列に変換する「トークン化」のサンプルです。HMACを利用することで、同じ入力値は常に同じトークンに変換されるため、データの匿名性を保ちつつ、ユーザーごとの行動分析などが可能になります。

**実行方法:**
```sh
node examples/tokenize.mjs
```

## 3. 検出されたPIIの確認 (`detect-dump.mjs`)

**概要:**
テキストをマスクする代わりに、どの部分がどの種類の個人情報として検出されたかの詳細な一覧を出力します。マスキングルールのデバッグや、検出精度の確認に役立ちます。

**実行方法:**
```sh
node examples/detect-dump.mjs
```

## 4. ストリーム処理 (`stream-redact.mjs`)

**概要:**
WHATWG Streams APIを利用して、大きなファイルを効率的に処理するサンプルです。ファイル全体をメモリに読み込むことなく、チャンク（断片）ごとにデータを処理するため、メモリ消費量を抑えることができます。チャンクの境界をまたいで存在する個人情報も正しく検出します。

**実行方法:**
```sh
# サンプルテキストファイルを入力として処理し、結果を標準出力に表示
node examples/stream-redact.mjs examples/basic-sample.txt

# 結果をファイルに保存する場合
node examples/stream-redact.mjs examples/basic-sample.txt > redacted-output.txt
```

## 5. セキュリティ情報のマスキング (`security-demo.mjs`)

**概要:**
`@himorishige/noren-plugin-security`プラグインを使用し、HTTPヘッダーに含まれる認証トークン（JWT）、APIキー、Cookieといった、技術的な機密情報をマスキングするサンプルです。

**実行方法:**
```sh
node examples/security-demo.mjs
```

## 6. カスタム辞書と動的リロード (`dictionary-demo.mjs`)

**概要:**
`@himorishige/noren-dict-reloader`を使用し、独自の検出ルールを定義した「カスタム辞書」を読み込むサンプルです。社員番号や製品コードなど、プロジェクト固有の機密情報パターンを定義できます。また、ETagを利用して、サーバーを再起動せずに辞書を動的に更新する「ホットリロード」機能も実演します。

サンプル辞書は `examples/dictionary-files/` にあります。

**実行方法:**
```sh
node examples/dictionary-demo.mjs
```

## 7. Webサーバーとの連携 (Hono) (`hono-server.mjs`)

**概要:**
軽量なWebフレームワーク`Hono`と連携し、実際に動作するAPIサーバーを構築するサンプルです。`/redact`エンドポイントにPOSTされたリクエストボディをストリーム処理し、個人情報をマスクした結果をレスポンスとして返します。

**実行前の準備:**
このサンプルを実行するには、`Hono`のパッケージを追加インストールする必要があります。
```sh
pnpm add hono @hono/node-server
```

**実行方法:**
1.  まず、以下のコマンドでAPIサーバーを起動します。
    ```sh
    node examples/hono-server.mjs
    # > Listening on http://localhost:8787
    ```
2.  次に、別のターミナルを開き、`curl`コマンドでサーバーにリクエストを送信します。
    ```sh
    curl -sS http://localhost:8787/redact -X POST --data-binary @examples/basic-sample.txt
    ```
