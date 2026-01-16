# Slack Claude Bot

A Slack bot that integrates with [Claude Code CLI](https://github.com/anthropics/claude-code) to provide AI-powered responses in Slack threads.

## Features

- **Thread-based sessions**: Each Slack thread maintains its own Claude session context
- **Mention-triggered**: Responds when mentioned with `@bot-name`
- **Automatic context continuation**: Follow-up messages in the same thread continue the conversation
- **Claude controls Slack directly**: Claude has full access to Slack API to post messages, add reactions, etc.
- **Socket Mode**: No public server required - connects via WebSocket

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://github.com/anthropics/claude-code) installed and authenticated
- Slack App with Socket Mode enabled

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Set these in your shell environment (e.g., `~/.bashrc`):

```bash
export SLACK_BOT_TOKEN="xoxb-..."  # Bot User OAuth Token
export SLACK_APP_TOKEN="xapp-..."  # App-Level Token (for Socket Mode)
export CLAUDE_WORKSPACE_DIR="~/my-workspace"  # Optional: Working directory for Claude
```

**CLAUDE_WORKSPACE_DIR** (optional):
- Sets the working directory where Claude CLI will run
- If set, Claude will look for `.claude/slack.md` in this directory for workspace-specific configuration
- If not set, defaults to the bot's current directory

### Slack App Setup

1. Create a new Slack App at [api.slack.com](https://api.slack.com/apps)
2. Enable **Socket Mode** in your app settings
3. Generate an **App-Level Token** with `connections:write` scope
4. Add the following **Bot Token Scopes**:
   - `app_mentions:read`
   - `channels:history`
   - `groups:history`
   - `chat:write`
   - `reactions:read`
   - `reactions:write`
5. Subscribe to these **Events**:
   - `app_mention`
   - `message.channels`
   - `message.groups`
6. Install the app to your workspace

## Usage

### Development

```bash
npm start
```

### Production

```bash
npm run build
./start.sh
```

### In Slack

1. Invite the bot to a channel: `/invite @your-bot-name`
2. Mention the bot with your message: `@your-bot-name What is TypeScript?`
3. Continue the conversation in the thread without mentioning

## Workspace-Specific Configuration

### Personality & Behavior (`.claude/slack.md`)

You can customize Claude's behavior per workspace:

```bash
# In your workspace
mkdir -p .claude
cat > .claude/slack.md <<'EOF'
# Project: MyApp

## Your Role
You are a code review assistant for MyApp.

## Guidelines
- Focus on TypeScript best practices
- Reference GitHub issues when relevant
- Be concise in responses
EOF
```

### Security Hooks (`.claude/settings.slack.json`)

For workspace-specific security policies, create `.claude/settings.slack.json`:

```bash
mkdir -p .claude/hooks
# Copy example from examples/security-hooks/
cp path/to/examples/security-hooks/settings.slack.json .claude/
cp path/to/examples/security-hooks/slack-security.sh .claude/hooks/
```

The bot uses `--settings .claude/settings.slack.json` when launching Claude, keeping Slack-specific hooks separate from your regular Claude Code settings.

Both configurations are automatically loaded when `CLAUDE_WORKSPACE_DIR` is set to your workspace directory.

## How It Works

1. When mentioned, the bot spawns Claude Code CLI with the message
2. Claude runs in the workspace directory (if `CLAUDE_WORKSPACE_DIR` is set)
3. Claude receives environment variables:
   - `SLACK_BOT_TOKEN`: Bot token for API access
   - `SLACK_CHANNEL`: Current channel ID
   - `SLACK_THREAD_TS`: Thread timestamp
   - `SLACK_MESSAGE_TS`: Current message timestamp
4. Claude loads prompts in layers:
   - System prompts (tasks/): Bot behavior basics
   - Workspace config (.claude/slack.md): Project-specific instructions (if exists)
   - User message: Current request
5. Claude uses Bash tool to call Slack API directly (via curl) for:
   - Posting messages
   - Adding reactions (including :thinking_face: progress indicator)
   - Fetching thread history when needed
   - Any other Slack actions
6. The session ID is stored per thread for context continuation
7. Subsequent messages in the thread automatically use the same session

## Limitations

- Claude Code CLI can only run one session at a time
- Running this bot will block interactive Claude Code usage

## License

MIT
