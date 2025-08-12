# リリースワークフロー

Norenプロジェクトでは、[Changesets](https://github.com/changesets/changesets)を使用した自動リリースフローを採用しています。このドキュメントでは、開発者とメンテナーがリリースプロセスを理解し、適切に実行するための手順を説明します。

## 概要

### 自動リリースフローの特徴

- **Monorepo対応**: 5つのパッケージ（noren-core + 4つのプラグイン）を統合管理
- **依存関係自動更新**: noren-coreが更新されると、依存するプラグインパッケージも自動的にバージョンアップ
- **段階的リリース**: alpha → beta → rc → stable の段階的リリース戦略
- **GitHub Actions統合**: mainブランチへのマージで自動リリース実行
- **npm自動公開**: 手動でのnpm publishは不要

## 開発者向け：変更をリリースに含める方法

### 1. 変更の実装

通常通りコードを変更・実装します。

### 2. Changesetの作成

変更内容をリリースに含めるため、changesetを作成します：

```bash
pnpm changeset
```

このコマンドを実行すると、対話形式で以下を選択・入力します：

1. **影響を受けるパッケージ**: 変更したパッケージを選択（複数選択可能）
2. **変更レベル**: 
   - `patch`: バグフィックス、軽微な変更（0.1.0 → 0.1.1）
   - `minor`: 新機能追加、後方互換性あり（0.1.0 → 0.2.0）
   - `major`: 破壊的変更、後方互換性なし（0.1.0 → 1.0.0）
3. **変更の説明**: ユーザー向けの変更内容説明（英語推奨）

### 3. Changesetファイルの確認

`.changeset/` ディレクトリ内に新しいファイルが生成されます：

```markdown
---
"@himorishige/noren-core": patch
"@himorishige/noren-plugin-jp": patch
---

Fix IPv6 detection for compressed notation
```

### 4. プルリクエスト作成

changesetファイルを含めてプルリクエストを作成します。

## メンテナー向け：リリース実行

### mainブランチへのマージ

プルリクエストがmainブランチにマージされると、GitHub Actionsが自動的に：

1. **CIチェック**: テスト・ビルド・lint実行
2. **バージョニング**: changesetに基づいてversion bump
3. **CHANGELOG生成**: GitHub統合でchangelogを自動生成
4. **npm公開**: 更新されたパッケージをnpmに公開

### 手動でのバージョン確認

```bash
# 現在のchangesetステータス確認
pnpm changeset:status

# 手動でのバージョニング（通常は不要）
pnpm changeset:version
```

## プレリリース戦略

### ブランチ別リリース

| ブランチ | 用途 | バージョン例 | npm tag |
|----------|------|--------------|---------|
| `main` | 安定版リリース | `0.2.0` | `latest` |
| `alpha` | 開発版・実験的機能 | `0.2.0-alpha.1` | `alpha` |
| `beta` | ベータ版・機能凍結後 | `0.2.0-beta.1` | `beta` |
| `rc` | リリース候補 | `0.2.0-rc.1` | `rc` |

### プレリリース版のインストール

```bash
# Alpha版
npm install @himorishige/noren-core@alpha

# Beta版  
npm install @himorishige/noren-core@beta

# Release Candidate
npm install @himorishige/noren-core@rc
```

## パッケージ構成

### リリース対象パッケージ

1. **@himorishige/noren-core**: コア機能
2. **@himorishige/noren-plugin-jp**: 日本固有PII検出
3. **@himorishige/noren-plugin-us**: 米国固有PII検出  
4. **@himorishige/noren-plugin-security**: セキュリティ機能
5. **@himorishige/noren-dict-reloader**: 辞書ホットリロード

### 依存関係管理

- プラグインパッケージは`noren-core`に依存
- `noren-core`がアップデートされると、依存パッケージも自動的にpatchバージョンアップ
- workspace依存関係（`workspace:*`）により開発時の依存関係を保証

## NPMパッケージとしてのリリース

### パッケージ公開設定

各パッケージは以下の設定でnpmに公開されます：

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

### リリース時の自動処理

1. **ビルド実行**: TypeScriptコンパイル、最小化
2. **ファイル選択**: `files`フィールドに基づいて`dist/`のみ公開
3. **バージョン同期**: 依存関係のあるパッケージのバージョン自動更新
4. **タグ付け**: npmとGitの両方で適切なタグ設定

### インストール方法

ユーザーは以下の方法でパッケージをインストールできます：

```bash
# 基本パッケージ
npm install @himorishige/noren-core

# 日本向けプラグイン
npm install @himorishige/noren-plugin-jp

# セキュリティプラグイン  
npm install @himorishige/noren-plugin-security

# 辞書リローダー
npm install @himorishige/noren-dict-reloader
```

## トラブルシューティング

### よくある問題

#### 1. Changesetなしでのプルリクエスト

CIで changeset チェックが失敗する場合：

```bash
pnpm changeset
```

を実行してchangesetを追加してください。

#### 2. リリース失敗

GitHub Actionsでリリースが失敗した場合：

1. `NPM_TOKEN`シークレットが正しく設定されているか確認
2. パッケージ名の衝突がないか確認
3. ビルドエラーがないか確認

#### 3. バージョン不整合

依存関係のバージョンが正しくない場合：

```bash
pnpm changeset:version
```

で手動バージョニングを実行してください。

## 設定ファイル

### .changeset/config.json

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    {
      "repo": "himorishige/noren"
    }
  ],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": false,
    "tag": false
  },
  "snapshot": {
    "useCalculatedVersion": true,
    "prereleaseTemplate": "{tag}-{commit}"
  }
}
```

### GitHub Actions設定

- `.github/workflows/release.yml`: メインリリース
- `.github/workflows/prerelease.yml`: プレリリース
- `.github/workflows/ci.yml`: 継続的インテグレーション

## 参考資料

- [Changesets公式ドキュメント](https://github.com/changesets/changesets)
- [pnpm Workspacesドキュメント](https://pnpm.io/workspaces)
- [Semantic Versioning](https://semver.org/)