# @himorishige/noren-core

Noren PIIマスキングライブラリのコアパッケージです。

このパッケージは、PIIの検出・マスキング・トークン化処理のエンジンとなる`Registry`クラス、主要な関数、そしてプラグインアーキテクチャの基礎となる型定義を提供します。

## 主な機能

- **プラグインアーキテクチャ**: `Registry`クラスを通じて、検出器（Detector）とマスカー（Masker）を柔軟に追加・管理できます。
- **豊富なアクション**: 検出されたPIIに対して、`mask`（マスク）、`remove`（除去）、`tokenize`（トークン化）のアクションをルールベースで指定できます。
- **共通PII検出**: メールアドレス、IPv4/IPv6アドレス、MACアドレス、クレジットカード番号（Luhnアルゴリズムチェック付き）など、世界共通で利用される基本的なPIIを標準で検出します。
- **Web標準準拠**: WHATWG StreamsやWeb Crypto APIなど、特定のランタイムに依存しないWeb標準技術をベースに構築されています。
- **HMACトークン化**: Web Crypto APIを利用したHMAC-SHA256ベースの決定論的トークン化をサポートします。

## インストール

```sh
pnpm add @himorishige/noren-core
```

## 基本的な使い方

```typescript
import { Registry, redactText } from '@himorishige/noren-core';

// Registryインスタンスを作成し、基本ルールを定義
const registry = new Registry({
  // デフォルトのアクションは 'mask'
  defaultAction: 'mask',
  // PIIタイプごとにルールを個別に設定
  rules: {
    credit_card: { action: 'mask', preserveLast4: true }, // クレジットカードは末尾4桁を保持
    email: { action: 'tokenize' }, // メールアドレスはトークン化
  },
});

const inputText = '連絡先: user@example.com, カード番号: 4242-4242-4242-4242';

// テキストの秘匿化処理を実行
// トークン化には hmacKey の指定が必須
const redactedText = await redactText(registry, inputText, {
  hmacKey: 'a-very-secure-secret-key-of-sufficient-length',
});

console.log(redactedText);
// 出力: 連絡先: TKN_EMAIL_5de1e4e7a3b4b5c6, カード番号: **** **** **** 4242
```

## API概要

- `Registry`: 検出器、マスカー、マスキングポリシーを一元管理する中央クラス。
- `redactText(registry, text, policy)`: 指定されたテキストに対して、Registryに登録されたルールに基づき秘匿化処理を実行します。
- `normalize(text)`: テキストを正規化（NFKC、空白文字の統一など）します。
- **型定義**: `PiiType`, `Hit`, `Action`, `Policy`, `Detector`, `Masker`など、プラグイン開発に必要な型を提供します。
