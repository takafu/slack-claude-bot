#!/bin/bash
# Slack Bot Security Hook
# Validates tool use based on channel, user, and content

TOOL_TYPE="$1"
TOOL_INPUT="$2"

# Get context from environment variables (set by bot)
CHANNEL="${SLACK_CHANNEL:-unknown}"
USER="${SLACK_USER_ID:-unknown}"

# Log for debugging
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tool: $TOOL_TYPE, Channel: $CHANNEL, User: $USER, Input: ${TOOL_INPUT:0:200}" >> ~/.claude/slack-security.log

# Configuration
ALLOWED_CHANNELS=("C3YC2P45S")  # Test channel
ADMIN_USERS=("U_ADMIN_TEST")    # Admin user (temporary: removed U3XK7TR1P for testing)
BLOCKED_COMMANDS=("rm -rf" "sudo" "reboot" "> /dev/" "curl.*password")

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
  deny "⛔ Channel $CHANNEL is not in allowed list. Contact admin to add."
fi

# Check 2: Dangerous commands (for non-admins)
if ! contains "$USER" "${ADMIN_USERS[@]}"; then
  for blocked in "${BLOCKED_COMMANDS[@]}"; do
    if echo "$TOOL_INPUT" | grep -qiE "$blocked"; then
      deny "⛔ Command contains blocked pattern: $blocked (non-admin users cannot use this)"
    fi
  done

  # Check 3: File write restrictions (for non-admins)
  if [ "$TOOL_TYPE" = "write" ]; then
    if echo "$TOOL_INPUT" | grep -qE '(\.bashrc|\.ssh|/etc/)'; then
      deny "⛔ Writing to system files is restricted for non-admin users"
    fi
  fi
fi

# All checks passed
allow
