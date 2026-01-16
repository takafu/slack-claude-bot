#!/bin/bash
# Slack Bot Security Hook
# Input comes via stdin as JSON

# Read JSON input from stdin
INPUT_JSON=$(cat)

# Get context from environment variables (set by bot)
CHANNEL="${SLACK_CHANNEL:-unknown}"
USER="${SLACK_USER_ID:-unknown}"

# Extract tool input from JSON
TOOL_INPUT=$(echo "$INPUT_JSON" | jq -r '.tool_input.command // .tool_input.file_path // ""' 2>/dev/null)

# Log for debugging
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Channel: $CHANNEL, User: $USER"
  echo "Tool Input: $TOOL_INPUT"
  echo "---"
} >> ~/.claude/slack-security.log

# Configuration
ALLOWED_CHANNELS=("C3YC2P45S")
ADMIN_USERS=("U3XK7TR1P")  # Restore actual admin user
BLOCKED_PATTERNS=("rm -rf" "sudo" "reboot")

# Helper: Check if value is in array
contains() {
  local value="$1"
  shift
  for item in "$@"; do
    if [[ "$value" == $item ]]; then
      return 0
    fi
  done
  return 1
}

# Helper: Output permission decision
deny() {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"$1\"}}"
  exit 0
}

allow() {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\"}}"
  exit 0
}

# Check 1: Channel whitelist
if ! contains "$CHANNEL" "${ALLOWED_CHANNELS[@]}"; then
  deny "⛔ Channel $CHANNEL is not in allowed list"
fi

# Check 2: Dangerous commands (for non-admins)
if ! contains "$USER" "${ADMIN_USERS[@]}"; then
  for blocked in "${BLOCKED_PATTERNS[@]}"; do
    if echo "$TOOL_INPUT" | grep -qiF "$blocked"; then
      deny "⛔ Blocked: contains '$blocked' (non-admin restriction)"
    fi
  done
fi

# All checks passed
allow
