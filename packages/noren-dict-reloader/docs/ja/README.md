# @himorishige/noren-dict-reloader

Noren PIIマスキングライブラリの拡張パッケージで、秘匿化ポリシーやカスタム辞書をリモートURLから動的に読み込み、定期的に更新（ホットリロード）する機能を提供します。

## 主な機能

- **動的な設定読み込み**: HTTP(S)経由でポリシーファイルや辞書ファイルを読み込み、Norenの`Registry`に適用します。
- **効率的な更新チェック**: HTTPの`ETag`ヘッダーを利用した差分チェックにより、ファイルに変更があった場合のみダウンロードを行い、不要なネットワークトラフィックを削減します。
- **ホットリロード**: アプリケーションを停止することなく、設定をバックグラウンドで定期的にリロードし、最新の状態に保ちます。
- **柔軟なリトライ処理**: 更新に失敗した場合、指数関数的バックオフ（Exponential Backoff）とジッター（Jitter）を用いて、サーバーに負荷をかけずにリトライします。
- **カスタムコンパイル**: 読み込んだポリシーと辞書を`Registry`に変換するロジックを、利用者が自由に実装できます。

## インストール

```sh
pnpm add @himorishige/noren-dict-reloader @himorishige/noren-core
```

## 基本的な使い方

```typescript
import { Registry } from '@himorishige/noren-core';
import { PolicyDictReloader } from '@himorishige/noren-dict-reloader';

// ポリシーと辞書をRegistryに変換するコンパイル関数を定義
function compile(policy, dicts) {
  const registry = new Registry(policy);
  // ここで、dictsの内容を解析してカスタム検出器を作成し、
  // registry.use()で登録する処理を実装します。
  console.log('Compiled with new policy and dictionaries.');
  return registry;
}

// リローダーを初期化
const reloader = new PolicyDictReloader({
  policyUrl: 'https://example.com/noren-policy.json',
  dictManifestUrl: 'https://example.com/noren-manifest.json',
  compile,
  intervalMs: 60000, // 60秒ごとに更新をチェック
  onSwap: (newRegistry, changed) => {
    console.log('Configuration updated. Changed files:', changed);
    // ここで、アプリケーションが使用するRegistryインスタンスを新しいものに差し替える
  },
  onError: (error) => {
    console.error('Failed to reload dictionary:', error);
  },
});

// ホットリロードを開始
await reloader.start();

// 初期化されたRegistryインスタンスを取得して使用開始
const initialRegistry = reloader.getCompiled();
```

## 辞書ファイルとマニフェスト

リローダーは `dictManifestUrl` で指定したマニフェストJSONと、そこから参照される1つ以上の辞書JSONを読み込む。

- マニフェストの形式:

```json
{
  "dicts": [
    { "id": "company", "url": "https://example.com/dicts/company-dict.json" }
  ]
}
```

- 辞書ファイルの形式（論理グループごとに1ファイルを想定）:

```json
{
  "entries": [
    {
      "pattern": "EMP\\d{5}",
      "type": "employee_id",
      "risk": "high",
      "description": "Employee ID format: EMP followed by 5 digits"
    }
  ]
}
```

補足:

- `pattern`: JavaScript の正規表現ソース文字列（スラッシュ不要）。通常 `gu` フラグでのコンパイルを想定。
- `type`: 検出タイプ。ビルトインに加えてカスタムの文字列も可。
- `risk`: `low` | `medium` | `high` のいずれか。
- `description`: 任意の説明（ドキュメント用途）。

テンプレート:

- パッケージ内の `example/manifest.template.json` と `example/dictionary.template.json` を参照。
- ルートの `examples/dictionary-files/company-dict.json` も実例として利用可能。

## 例: 辞書エントリを検出器として登録する compile()

以下は、読み込んだ辞書をカスタム検出器に変換して `Registry` に登録する最小例。

```ts
import type { Detector, PiiType, Policy } from '@himorishige/noren-core'
import { Registry } from '@himorishige/noren-core'

type DictEntry = { pattern: string; type: string; risk: 'low' | 'medium' | 'high'; description?: string }
type DictFile = { entries?: DictEntry[] }

function compile(policy: unknown, dicts: unknown[]) {
  const registry = new Registry((policy ?? {}) as Policy)
  const detectors: Detector[] = []

  for (const d of dicts) {
    const entries = (d as DictFile).entries ?? []
    for (const e of entries) {
      if (!e?.pattern || !e?.type || !e?.risk) continue
      let re: RegExp
      try {
        re = new RegExp(e.pattern, 'gu')
      } catch {
        continue
      }
      detectors.push({
        id: `dict:${e.type}:${e.pattern}`,
        priority: 100,
        match: (u) => {
          for (const m of u.src.matchAll(re)) {
            if (m.index === undefined) continue
            u.push({
              type: e.type as PiiType,
              start: m.index,
              end: m.index + m[0].length,
              value: m[0],
              risk: e.risk,
            })
          }
        },
      })
    }
  }

  // 必要ならマスカーやコンテキストヒントも同時登録できる:
  // registry.use(detectors, { employee_id: (h) => `EMP_***${h.value.slice(-4)}` }, ['社員番号', 'employee'])
  registry.use(detectors)
  return registry
}
```

## ローカルファイルとカスタムローダー

HTTP(S) でホスティングできない場合は、`load` オプションで取得方法を差し替えられる。

Node.js で `file://` を使う最短例:

```ts
import { PolicyDictReloader, fileLoader } from '@himorishige/noren-dict-reloader'

const reloader = new PolicyDictReloader({
  policyUrl: 'file:///abs/path/to/policy.json',
  dictManifestUrl: 'file:///abs/path/to/manifest.json',
  compile,
  load: fileLoader, // file:// を有効化。非 file:// は従来のHTTPローダーに委譲
})
await reloader.start()
```

補足:

- `fileLoader` はファイル内容の SHA-256 を ETag とし、ファイルの mtime を Last-Modified 相当として扱う。
- `file://` 以外のURLはビルトインの HTTP(S) ローダーにフォールバックする。
- 独自ストレージ向けに、`LoaderFn` 型のローダーを自作して `load` に渡すことも可能。

## Tips

- サーバー側は `ETag` または `Last-Modified` と、ブラウザ利用時は適切な CORS ヘッダーを返すこと。
- `onSwap` の `changed` には `policy` / `manifest` / `dict:<id>` / `dict-removed:<id>` が入ることがある。
- `forceReload()` は必要に応じて `_bust` パラメーターを付与してキャッシュを回避する。
