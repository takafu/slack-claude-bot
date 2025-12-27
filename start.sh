#!/bin/bash
# Slack Claude Bot startup script
# Run in a separate terminal session (Claude Code CLI can only run one session at a time)

cd "$(dirname "$0")"

# Load environment variables from .bashrc
source ~/.bashrc 2>/dev/null

# Check required environment variables
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_APP_TOKEN" ]; then
    echo "Error: SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set"
    echo "Add them to ~/.bashrc or export them before running"
    exit 1
fi

echo "Starting Slack Claude Bot..."
echo "Bot Token: ${SLACK_BOT_TOKEN:0:20}..."
echo "App Token: ${SLACK_APP_TOKEN:0:20}..."
echo "Workspace: ${CLAUDE_WORKSPACE_DIR:-$(pwd)}"

# Run compiled JS (lighter than ts-node)
node dist/index.js
