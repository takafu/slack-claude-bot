# slack-claude-bot 開発ログ

## プロジェクト概要

Slack上でClaude Code CLIを呼び出し、Claudeが自律的にSlack APIを操作できるボット。
公式の「Claude Code in Slack」よりも柔軟で、リアクション追加や返信判断などをClaude自身が行える。

## 開発経緯

### Phase 1: 基本構造の実装（2025-12-09）

**実装内容:**
- Socket Modeで接続
- `@bot-name` メンション時にClaude Code CLI (`claude -p`) を起動
- スレッドごとにセッションID管理（`-r SESSION_ID`）

**遭遇した問題:**
- Bashツールから `claude` コマンドを実行するとタイムアウト
- 原因: TTYが無い環境では動かない（`not a tty`）

### Phase 2: TTY問題の解決

**調査:**
- repl-mcp内では動作することを確認（`/dev/pts/1`）
- Bashツールには標準でTTYが無い

**解決策:**
```typescript
const proc = spawn('script', ['-q', '-c', `bash -l -c "${claudeCommand}"`, '/dev/null'], {
  env: { ...process.env },
});
```
- `script` コマンドでTTYをエミュレート
- Claude CLIが正常に動作

### Phase 3: 出力形式の改善

**問題:**
- 最初の応答にANSIエスケープコードが混入
- 例: `こんにちは！[?25h[?25h`

**解決策:**
- `--output-format json` に変更
- stdout内でJSON行を探してパース（複数行対応）

```typescript
const lines = cleanOutput.split('\n');
for (const line of lines) {
  if (trimmed.startsWith('{') && trimmed.includes('"result"')) {
    json = JSON.parse(trimmed);
    break;
  }
}
```

### Phase 4: マークダウン変換の試み（未完）

**実装:**
```typescript
function toSlackMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')      // Headers
    .replace(/\*\*(.+?)\*\*/g, '*$1*')         // Bold
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')  // Links
    .replace(/^(\s*)-\s+/gm, '$1• ');          // Lists
}
```

**問題:**
- 太字（`**text**`）がアスタリスク付きのまま表示される
- デバッグログ追加したが未確認

**→ 次のフェーズで方針転換により保留**

### Phase 5: 公式統合の発見と比較（2025-12-10）

**発見:**
- Anthropicが2025年12月に「Claude Code in Slack」をリリース
- 公式ドキュメント: https://code.claude.com/docs/en/slack

**公式統合の制約:**
- GitHub専用
- @メンション必須（自律判断不可）
- リアクション等の細かい制御不可
- Bot名カスタマイズ不可（`@Claude`固定）
- DMでは動作しない

**判断:**
カスタム実装を継続（柔軟性・学習価値）

### Phase 6: アーキテクチャ変更 ✅

**大きな方針転換:**
- Bot側での自動メッセージ投稿を廃止
- Claudeに完全に制御を委譲

**実装:**
```typescript
// Claude CLI呼び出し時に環境変数追加
env: {
  ...process.env,
  SLACK_CHANNEL: channel,
  SLACK_THREAD_TS: threadTs,
}
```

**Claudeの役割:**
- 環境変数から `$SLACK_BOT_TOKEN`, `$SLACK_CHANNEL`, `$SLACK_THREAD_TS` を取得
- Bashツールで `curl` を使ってSlack APIを直接呼び出し
- 返信、リアクション、ピン留めなど全てをClaude自身が判断・実行

**利点:**
- 新しいアクション追加時にBot側のコード修正不要
- Claudeが文脈から適切な行動を自律判断
- 統一感のある実装

**コミット:**
```
feat: delegate Slack API control to Claude (271bc9c)
```

## 現在の状況（2025-12-21更新）

### ✅ 完了・動作確認済み
- [x] TTYエミュレーション実装（`spawn('bash')` 使用）
- [x] JSON出力パース
- [x] 環境変数経由でSlack API情報を渡す（`SLACK_CHANNEL`, `SLACK_THREAD_TS`）
- [x] Bot側の自動投稿ロジック削除（Claude側で完全制御）
- [x] プロンプトシステム実装（`tasks/_shared/slack-api.md`, `tasks/mention.md`）
- [x] **動作確認成功**: Slackに返信が来ることを確認
  - Bot ID修正: `U08UCRV618E` (test1)
  - 実際の返信例: "テストメッセージを受信しました！ :robot_face:"
- [x] README/ARCHITECTURE更新
- [x] GitHubにプッシュ（https://github.com/takafu/slack-claude-bot）
- [x] テスト用スクリプト作成（send-test-message.sh等）

### ⚠️ 既知の問題
- **Claudeプロセスが終了しない**: `spawn('bash')` で実行すると応答は返るが、プロセスが残り続ける
  - 原因: 調査中（TTYの問題？対話モード？）
  - 回避策: 手動でプロセスをkillする必要あり
  - `spawn('script')` を使うとプロセスは終了するが、別の問題が発生

### 🔧 次のステップ
- Claudeプロセスが正常終了する方法を見つける
- セッション管理のテスト（スレッド内の続き）
- エラーハンドリング強化

## 技術スタック

- **言語**: TypeScript
- **Slack SDK**: @slack/bolt (Socket Mode)
- **Claude**: Claude Code CLI
- **環境**: Termux on Android

## ファイル構成

```
slack-claude-bot/
├── src/
│   └── index.ts           # メインBot実装
├── ARCHITECTURE.md        # 設計思想・公式統合との比較
├── README.md              # 使い方
├── CLAUDE.md              # 開発ログ（本ファイル）
├── package.json
├── tsconfig.json
├── start.sh               # 起動スクリプト
└── .gitignore
```

## 次のステップ

1. **動作テスト**
   - Slackからメッセージ送信
   - Claudeが環境変数を認識できるか確認
   - Slack API呼び出しが成功するか確認

2. **初期プロンプト検討**
   - Claudeに「Slack API使えるよ」と伝える仕組み
   - システムプロンプトまたは指示書ファイル

3. **エラーハンドリング強化**
   - Claude側でAPI呼び出し失敗時の処理
   - Bot側でのエラーメッセージ表示

## 参考リンク

- [Claude Code公式ドキュメント](https://code.claude.com/docs)
- [Claude Code in Slack](https://code.claude.com/docs/en/slack)
- [Slack Bolt SDK](https://slack.dev/bolt-js)
- [Slack API Documentation](https://api.slack.com/)
