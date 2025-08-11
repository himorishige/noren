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
