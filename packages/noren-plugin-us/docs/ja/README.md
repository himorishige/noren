# @himorishige/noren-plugin-us

Noren PIIマスキングライブラリのプラグインで、米国の個人情報（PII）に特化したディテクターとマスカーを提供します。

## 主な機能

- **米国固有のPII検出**: 米国で利用される主要な個人情報を検出します。
  - **電話番号**: `(123) 456-7890` や `+1-123-456-7890` といった一般的な形式
  - **ZIPコード**: 5桁の`12345`および9桁の`12345-6789`形式
  - **社会保障番号 (SSN)**: `123-45-6789`の形式
- **文脈に応じた高精度な検出**: `「ZIP」`、`「SSN」`といった周辺のキーワード（コンテキストヒント）を手がかりに、誤検出を減らし、検出精度を高めます。
- **適切なマスキング**: 各PIIの特性に応じたマスキング処理を提供します。（例: SSNは末尾4桁を保持）

## インストール

```sh
pnpm add @himorishige/noren-plugin-us @himorishige/noren-core
```

## 基本的な使い方

```typescript
import { Registry, redactText } from '@himorishige/noren-core';
import * as usPlugin from '@himorishige/noren-plugin-us';

// Registryを初期化
const registry = new Registry({
  defaultAction: 'mask',
  // 検出精度向上のため、関連キーワードをヒントとして設定
  contextHints: ['Phone', 'Address', 'ZIP', 'SSN'],
});

// 米国向けプラグインのディテクターとマスカーを登録
registry.use(usPlugin.detectors, usPlugin.maskers);

const inputText = 'My SSN is 123-45-6789 and my ZIP code is 94105.';

// 秘匿化処理を実行
const redactedText = await redactText(registry, inputText);

console.log(redactedText);
// 出力: My SSN is ***-**-6789 and my ZIP code is •••••.
```

## 検出対象

| PIIタイプ   | 説明 | マスク例 (`mask`) | v0.5.0 |
| :--------- | :--- | :--- | :------ |
| `phone_us` | 米国の電話番号 | `(•••) •••-••••` | ✓ 名称変更 |
| `zip_us`   | 米国のZIPコード | `•••••` または `•••••-••••` | ✓ 名称変更 |
| `ssn_us`   | 社会保障番号 (SSN) | `***-**-6789` | ✓ 名称変更 |
