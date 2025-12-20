# slack-claude-bot アーキテクチャ

## 概要

SlackからClaude Codeを呼び出すボット。Termux環境で動作。

## 技術スタック

- **言語**: TypeScript
- **Slack SDK**: @slack/bolt (Socket Mode)
- **Claude**: Claude Code CLI (`claude -p`)
- **将来**: Claude Agent SDK / APIキー認証への移行も可能

## アーキテクチャ

```
Slack (Socket Mode)
    │
    ▼
Node.js デーモン (@slack/bolt)
    │
    ├─ イベント受信 (message, app_mention等)
    │
    ▼
タスク振り分け
    │
    ├─ 指示書(.md)を読み込み
    │
    ▼
claude -p --dangerously-skip-permissions "指示書 + コンテキスト"
    │
    ▼
Slackへ返信
```

## トリガーパターン

### 1. イベントドリブン (event)
- スレッド内でのメンション/メッセージ
- チームメンション監視
- リアクション監視

### 2. 定期実行 (cron)
- 未返信スレッド巡回
- アラート未対応チェック
- 日次/週次レポート

## セッション管理

### 基本方針
- **1スレッド = 1セッションID**
- `claude -r SESSION_ID` でコンテキスト継続

### 将来拡張（必要になったら）
- `/link session-name` で名前付け
- `/use session-name` で別スレッドから同セッション使用

## 決定事項

### 採用
- [x] Socket Mode（サーバー公開不要）
- [x] Claude Code CLI呼び出し（Proサブスク認証）
- [x] TypeScript（Slack SDK/Claude SDK両方対応）
- [x] 指示書(.md)で挙動をカスタマイズ
- [x] ボットを監視対象チャンネルに招待してフィルタ

### 不採用（理由）
- [ ] MCP双方向通信 → MCPはクライアント主導のみ、サーバーからプッシュ不可
- [ ] Claude SDK/API直接 → APIキー必要、Proサブスクでは使えない
- [ ] 抽象化レイヤー → CLI/SDK切り替えは簡単なのでYAGNI
- [ ] 自動コンテキストマッチング → 誤爆リスク、デバッグ困難
- [ ] 別スレッドへの自動書き込み → 通知カオス、プライバシーリスク

### 将来検討
- [ ] APIキー取得後にAgent SDK移行
- [ ] 明示的なセッションリンク機能
- [ ] 自発回答モード（練習用チャンネルから開始）

## 指示書による挙動制御

コード側は最小限（event/cronの2パターン）、挙動は日本語指示書で制御:

```
tasks/
├── thread-reply.md      # スレッド内会話
├── team-mention.md      # チームメンション監視
└── daily-report.md      # 日次巡回レポート
```

### 指示書の例

```markdown
# tasks/team-mention.md

## トリガー
@support-team へのメンションを監視

## 判断基準
以下の場合のみ回答:
- 技術的な質問である
- ドキュメントやコードで答えられる
- 人間の承認が不要

## 出力先
練習モード: #claude-sandbox
本番モード: 元スレッド

## 現在のモード
練習モード
```

## ボットの権限（bot-test app）

### 必要なスコープ（確認済み）
- `channels:history` / `groups:history` - メッセージ読み取り
- `chat:write` - メッセージ送信
- `app_mentions:read` - メンション検知
- `reactions:read` / `reactions:write` - リアクション

### イベント購読
- `message.channels` - パブリックチャンネルのメッセージ
- `message.groups` - プライベートチャンネルのメッセージ
- `app_mention` - ボットへのメンション

## 起動方法

```bash
# 別のTermuxセッションで実行（Claude Code終了後に）
~/slack-claude-bot/start.sh
```

**重要**: Claude Code CLIは同時に1セッションしか実行できない制限がある模様。
ボットを起動する際は、Claude Codeインタラクティブセッションを終了してから実行すること。

## 注意事項

- ボットはユーザーグループに追加できない（Slack仕様）
- チームメンション検知はメッセージ内容をパースして判定
- 監視はボットが参加しているチャンネルのみ
- **Claude Code CLIは同時実行制限あり** - ボット実行中はClaude Code対話モードを使えない

## 公式統合との比較

Anthropicは2025年12月にClaude Code in Slackを研究プレビューとしてリリースした。
公式ドキュメント: https://code.claude.com/docs/en/slack

### 公式統合 (Claude Code in Slack)

**特徴:**
- Slack Marketplaceからインストール、`claude.ai/code`と連携
- `@Claude`メンションで自動的にコーディングタスクを検知
- スレッド/チャンネルの文脈を自動収集
- GitHub専用、セッションごとに1PR作成
- Webブラウザで`claude.ai/code`にアクセス必須

**制約:**
- ❌ GitHubのみ対応（GitLab/Bitbucket不可）
- ❌ Bot名カスタマイズ不可（`@Claude`固定）
- ❌ DMでは動作しない（チャンネルのみ）
- ❌ @メンション必須（自律判断不可）
- ❌ リアクション追加などの細かい制御不可
- ❌ セッションごとに1PR制限

### 本実装 (カスタムボット)

**利点:**
- ✅ VCS非依存（GitHub/GitLab/ローカルリポジトリ等）
- ✅ Bot名・挙動を完全カスタマイズ可能
- ✅ Slack API全機能を使用可能（リアクション、ピン、複数投稿等）
- ✅ Claude側で自律判断（返信要否、アクション選択）
- ✅ 環境変数でSlack APIアクセス権を渡し、Claude自身が操作
- ✅ 軽量・ローカル実行（Termux環境）
- ✅ セッション制限なし、複数PR可

**用途の違い:**
- **公式統合**: チームでのクイックスタート、GitHub PR中心ワークフロー
- **本実装**: 柔軟な自動化、学習・実験用、Termux環境での運用

### 本実装の設計判断

**Claude側にSlack API制御を委譲:**
- 環境変数 `SLACK_BOT_TOKEN`, `SLACK_CHANNEL`, `SLACK_THREAD_TS` を渡す
- Claudeが自分でBashツール（curl）を使ってSlack APIを呼び出す
- Bot側は返信の自動投稿を行わず、Claudeの判断に全て任せる

**利点:**
- 新しいアクション追加時にBot側のコード修正不要
- Claudeが文脈から適切な行動を自律判断（リアクションのみ、複数メッセージ、何もしない等）
- 統一感のある実装（返信もリアクションも全てClaude側で処理）
