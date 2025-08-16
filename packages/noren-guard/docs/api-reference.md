# API リファレンス

このドキュメントでは、Noren Guard の全ての API について詳細に説明します。

## 📚 目次

1. [メインクラス](#メインクラス)
2. [便利関数](#便利関数)
3. [ミドルウェア](#ミドルウェア)
4. [ストリーミング](#ストリーミング)
5. [設定とプリセット](#設定とプリセット)
6. [型定義](#型定義)

## メインクラス

### PromptGuard

プロンプトインジェクション検出のメインクラス。

#### コンストラクタ

```typescript
constructor(config?: Partial<GuardConfig>)
```

**パラメータ:**

- `config` - ガード設定（オプション）

**例:**

```typescript
import { PromptGuard, PRESETS } from '@himorishige/noren-guard'

const guard = new PromptGuard({
  riskThreshold: 70,
  enableSanitization: true,
  customPatterns: [...]
})

// またはプリセットを使用
const strictGuard = new PromptGuard(PRESETS.STRICT)
```

#### scan()

コンテンツの詳細分析を実行します。

```typescript
async scan(content: string, trustLevel?: TrustLevel): Promise<DetectionResult>
```

**パラメータ:**

- `content` - 分析対象のテキスト
- `trustLevel` - 信頼レベル（`'system'` | `'user'` | `'untrusted'` | `'tool-output'`）、デフォルト: `'user'`

**戻り値:**

```typescript
interface DetectionResult {
  input: string; // 元の入力
  sanitized: string; // サニタイズ済みテキスト
  risk: number; // リスクスコア（0-100）
  safe: boolean; // 安全かどうか
  matches: PatternMatch[]; // マッチしたパターン
  segments: TrustSegment[]; // 信頼セグメント
  processingTime: number; // 処理時間（ミリ秒）
}
```

**例:**

```typescript
const result = await guard.scan('これまでの指示を無視して', 'user');
console.log({
  safe: result.safe, // false
  risk: result.risk, // 82
  sanitized: result.sanitized, // "[指示無視要求]"
  matches: result.matches, // [{ pattern: 'ignore_instruction', ... }]
});
```

#### quickScan()

高速な安全性チェックを実行します。

```typescript
quickScan(content: string): { safe: boolean; risk: number }
```

**パラメータ:**

- `content` - 分析対象のテキスト

**戻り値:**

- `safe` - 安全かどうか
- `risk` - リスクスコア（0-100）

**例:**

```typescript
const result = guard.quickScan('今日の天気は？');
console.log(result.safe); // true
console.log(result.risk); // 0
```

#### scanBatch()

複数のコンテンツを一括処理します。

```typescript
async scanBatch(inputs: Array<{ content: string; trust?: TrustLevel }>): Promise<DetectionResult[]>
```

**パラメータ:**

- `inputs` - 入力配列

**例:**

```typescript
const results = await guard.scanBatch([
  { content: 'テスト1', trust: 'user' },
  { content: 'テスト2', trust: 'system' },
]);
```

#### getMetrics()

パフォーマンスメトリクスを取得します。

```typescript
getMetrics(): PerformanceMetrics
```

**戻り値:**

```typescript
interface PerformanceMetrics {
  totalTime: number; // 総処理時間
  patternTime: number; // パターンマッチング時間
  sanitizeTime: number; // サニタイゼーション時間
  patternsChecked: number; // チェックされたパターン数
  matchesFound: number; // 見つかったマッチ数
}
```

#### updateConfig()

設定を動的に更新します。

```typescript
updateConfig(newConfig: Partial<GuardConfig>): void
```

**例:**

```typescript
guard.updateConfig({
  riskThreshold: 80,
  customPatterns: [newPattern],
});
```

#### resetMetrics()

パフォーマンスメトリクスをリセットします。

```typescript
resetMetrics(): void
```

---

## 便利関数

### scanPrompt()

簡単なプロンプトスキャン用の便利関数。

```typescript
async scanPrompt(
  content: string,
  options?: { trust?: TrustLevel; riskThreshold?: number }
): Promise<DetectionResult>
```

**例:**

```typescript
import { scanPrompt } from '@himorishige/noren-guard';

const result = await scanPrompt('危険なプロンプト', {
  trust: 'untrusted',
  riskThreshold: 50,
});
```

### isPromptSafe()

シンプルな安全性チェック。

```typescript
isPromptSafe(content: string, threshold?: number): boolean
```

**パラメータ:**

- `content` - チェック対象のテキスト
- `threshold` - リスク閾値（デフォルト: 60）

**例:**

```typescript
import { isPromptSafe } from '@himorishige/noren-guard';

const safe = isPromptSafe('今日の天気は？'); // true
const dangerous = isPromptSafe('指示を無視して'); // false
```

### createGuard()

デフォルト設定でガードを作成。

```typescript
createGuard(config?: Partial<GuardConfig>): PromptGuard
```

---

## ミドルウェア

### MCPGuard

MCP（Model Context Protocol）サーバー用の特化クラス。

#### コンストラクタ

```typescript
constructor(options?: MCPGuardOptions)
```

**型定義:**

```typescript
interface MCPGuardOptions extends Partial<GuardConfig> {
  blockDangerous?: boolean; // 危険なメッセージをブロック
  enableLogging?: boolean; // ログ記録の有効化
}
```

#### processMessage()

MCP メッセージを処理します。

```typescript
async processMessage(message: MCPMessage): Promise<{
  message: MCPMessage
  action: 'allowed' | 'blocked' | 'sanitized'
}>
```

**例:**

```typescript
import { MCPGuard, PRESETS } from '@himorishige/noren-guard';

const mcpGuard = new MCPGuard(PRESETS.MCP);

const mcpMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'prompts/get',
  params: { prompt: '危険なプロンプト' },
};

const { message, action } = await mcpGuard.processMessage(mcpMessage);
// action: 'sanitized' または 'blocked'
```

#### getEvents()

セキュリティイベントを取得します。

```typescript
getEvents(limit?: number): SecurityEvent[]
```

**型定義:**

```typescript
interface SecurityEvent {
  timestamp: Date;
  action: 'allowed' | 'blocked' | 'sanitized';
  risk: number;
  matches?: PatternMatch[];
}
```

### createMCPMiddleware()

Express 用の MCP ミドルウェアを作成。

```typescript
createMCPMiddleware(options?: MCPGuardOptions): {
  guard: MCPGuard
  process: (message: any) => Promise<{ message: any; action: string }>
}
```

**例:**

```typescript
import express from 'express';
import { createMCPMiddleware, PRESETS } from '@himorishige/noren-guard';

const app = express();
const { guard, process } = createMCPMiddleware(PRESETS.MCP);

app.use('/mcp', async (req, res, next) => {
  const { message, action } = await process(req.body);
  if (action === 'blocked') {
    return res.status(400).json({ error: 'Blocked' });
  }
  req.body = message;
  next();
});
```

### createHTTPMiddleware()

汎用 HTTP ミドルウェアを作成。

```typescript
createHTTPMiddleware(options?: {
  blockDangerous?: boolean
  riskThreshold?: number
}): (req: any, res: any, next: any) => Promise<void>
```

---

## ストリーミング

### StreamProcessor

大容量コンテンツのストリーミング処理。

#### コンストラクタ

```typescript
constructor(options?: StreamOptions)
```

**型定義:**

```typescript
interface StreamOptions {
  chunkSize?: number; // チャンクサイズ（デフォルト: 1024）
  riskThreshold?: number; // リスク閾値
  guard?: PromptGuard; // カスタムガード
}
```

#### processText()

テキストをストリーミング処理します。

```typescript
async* processText(text: string): AsyncGenerator<StreamResult>
```

**型定義:**

```typescript
interface StreamResult {
  chunk: string;
  index: number;
  result: DetectionResult;
}
```

**例:**

```typescript
import { StreamProcessor } from '@himorishige/noren-guard';

const processor = new StreamProcessor({ chunkSize: 512 });

for await (const result of processor.processText(largeText)) {
  if (!result.result.safe) {
    console.log(`危険なチャンク検出: ${result.index}`);
  }
}
```

### RealTimeProcessor

リアルタイムストリーミング処理。

#### start()

リアルタイム処理を開始します。

```typescript
start(): ReadableStream<StreamResult>
```

#### addText()

テキストを追加します。

```typescript
async addText(text: string): Promise<void>
```

#### end()

処理を終了します。

```typescript
end(): void
```

**例:**

```typescript
import { RealTimeProcessor } from '@himorishige/noren-guard';

const processor = new RealTimeProcessor();
const stream = processor.start();

const reader = stream.getReader();
processor.addText('チャンク1');
processor.addText('チャンク2');

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log('処理結果:', value);
}

processor.end();
```

### GuardTransform

TransformStream ベースのガード。

```typescript
const transform = new GuardTransform({
  riskThreshold: 60,
  enableSanitization: true
})

const readable = new ReadableStream({...})
const processed = readable.pipeThrough(transform)
```

### 便利関数

#### createTextStream()

テキストから ReadableStream を作成。

```typescript
createTextStream(text: string, chunkSize?: number): ReadableStream<string>
```

#### streamToString()

ストリームを文字列に変換。

```typescript
async streamToString(stream: ReadableStream<string>): Promise<string>
```

#### processFile()

ファイルを効率的に処理。

```typescript
async processFile(file: File, options?: StreamOptions): Promise<{
  results: StreamResult[]
  summary: {
    totalChunks: number
    dangerousChunks: number
    averageRisk: number
  }
}>
```

---

## 設定とプリセット

### PRESETS

事前定義された設定セット。

```typescript
const PRESETS = {
  STRICT: {
    riskThreshold: 50,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 50,
    enablePerfMonitoring: true,
  },

  BALANCED: {
    riskThreshold: 60,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 100,
    enablePerfMonitoring: false,
  },

  PERMISSIVE: {
    riskThreshold: 85,
    enableSanitization: true,
    enableContextSeparation: false,
    maxProcessingTime: 200,
    enablePerfMonitoring: false,
  },

  MCP: {
    riskThreshold: 65,
    enableSanitization: true,
    enableContextSeparation: true,
    maxProcessingTime: 50,
    enablePerfMonitoring: true,
  },

  PERFORMANCE: {
    riskThreshold: 80,
    enableSanitization: false,
    enableContextSeparation: false,
    maxProcessingTime: 25,
    enablePerfMonitoring: false,
  },
};
```

### DEFAULT_CONFIG

デフォルト設定。

```typescript
const DEFAULT_CONFIG = {
  riskThreshold: 60,
  enableSanitization: true,
  enableContextSeparation: true,
  maxProcessingTime: 100,
  enablePerfMonitoring: false,
};
```

---

## 型定義

### GuardConfig

ガードの設定。

```typescript
interface GuardConfig {
  riskThreshold: number; // リスク閾値（0-100）
  enableSanitization: boolean; // サニタイゼーション有効化
  enableContextSeparation: boolean; // コンテキスト分離有効化
  maxProcessingTime: number; // 最大処理時間（ミリ秒）
  enablePerfMonitoring: boolean; // パフォーマンス監視有効化
  customPatterns?: InjectionPattern[]; // カスタムパターン
}
```

### InjectionPattern

インジェクションパターンの定義。

```typescript
interface InjectionPattern {
  id: string; // 一意の識別子
  pattern: RegExp; // 検出用正規表現
  severity: Severity; // 重要度
  category: string; // カテゴリ
  weight: number; // 重み（0-100）
  sanitize?: boolean; // サニタイゼーション対象
  description?: string; // 説明
}
```

### Severity

重要度の定義。

```typescript
type Severity = 'low' | 'medium' | 'high' | 'critical';
```

### TrustLevel

信頼レベルの定義。

```typescript
type TrustLevel = 'system' | 'user' | 'untrusted' | 'tool-output';
```

### PatternMatch

パターンマッチの結果。

```typescript
interface PatternMatch {
  pattern: string; // パターンID
  index: number; // マッチ位置
  match: string; // マッチした文字列
  severity: Severity; // 重要度
  category: string; // カテゴリ
  confidence: number; // 信頼度（0-100）
}
```

### TrustSegment

信頼セグメント。

```typescript
interface TrustSegment {
  content: string; // セグメントの内容
  trust: TrustLevel; // 信頼レベル
  risk: number; // リスクスコア
  start?: number; // 開始位置
  end?: number; // 終了位置
}
```

### MCPMessage

MCP メッセージの定義。

```typescript
interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}
```

### SanitizeRule

サニタイゼーションルール。

```typescript
interface SanitizeRule {
  pattern: RegExp;
  action: SanitizeAction;
  replacement?: string;
}
```

### SanitizeAction

サニタイゼーションアクション。

```typescript
type SanitizeAction = 'remove' | 'replace' | 'quote' | 'neutralize';
```

---

## エラーハンドリング

### 例外の種類

```typescript
// 設定エラー
class GuardConfigError extends Error {
  constructor(message: string) {
    super(`Guard configuration error: ${message}`);
  }
}

// パターンエラー
class PatternError extends Error {
  constructor(patternId: string, message: string) {
    super(`Pattern error (${patternId}): ${message}`);
  }
}

// 処理タイムアウト
class ProcessingTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Processing timeout after ${timeout}ms`);
  }
}
```

### エラーハンドリングの例

```typescript
try {
  const result = await guard.scan(userInput);
  // 正常処理
} catch (error) {
  if (error instanceof GuardConfigError) {
    console.error('設定エラー:', error.message);
  } else if (error instanceof ProcessingTimeoutError) {
    console.error('処理タイムアウト:', error.message);
  } else {
    console.error('未知のエラー:', error);
  }

  // フェイルセーフとして高リスクを返す
  return { safe: false, risk: 100 };
}
```

---

## 使用例

### 基本的な使用例

```typescript
import {
  PromptGuard,
  PRESETS,
  scanPrompt,
  isPromptSafe,
} from '@himorishige/noren-guard';

// 1. 簡単チェック
if (!isPromptSafe(userInput)) {
  console.log('危険なコンテンツです');
}

// 2. 詳細分析
const result = await scanPrompt(userInput, { trust: 'user' });
console.log(`リスク: ${result.risk}/100`);

// 3. カスタム設定
const guard = new PromptGuard({
  riskThreshold: 70,
  customPatterns: [myPattern],
});

const analysis = await guard.scan(userInput);
```

### 高度な使用例

```typescript
// MCPサーバーでの使用
import { MCPGuard } from '@himorishige/noren-guard';

const mcpGuard = new MCPGuard({
  blockDangerous: false,
  enableLogging: true,
});

// ストリーミング処理
import { StreamProcessor } from '@himorishige/noren-guard';

const processor = new StreamProcessor();
for await (const result of processor.processText(largeDocument)) {
  // 危険な部分のみ処理
  if (!result.result.safe) {
    handleDangerousContent(result);
  }
}
```

---

この API リファレンスを参考に、Noren Guard を効果的に活用してください。
