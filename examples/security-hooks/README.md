# Security Hooks Example - VERIFIED WORKING ✅

This example demonstrates workspace-level security hooks for Slack bot integration.

**Status:** Fully tested and confirmed working. Hooks successfully block dangerous operations and Claude reports the restriction to users.

## Files

- `settings.slack.json` - Slack-specific hook configuration (place in workspace `.claude/`)
- `slack-security.sh` - Security validation script (place in workspace `.claude/hooks/`)

## Why settings.slack.json?

Using a separate settings file allows you to:
- Keep different hooks for interactive Claude Code vs Slack bot usage
- Share the same workspace for both contexts without conflicts
- Gitignore Slack-specific settings while committing regular settings

The bot uses `--settings .claude/settings.slack.json` flag when launching Claude.

## Verified Behavior

**Test:** Non-admin user sends `rm -rf /tmp/test`
**Result:**
1. Hook detects pattern `rm -rf`
2. Returns `permissionDecision: "deny"`
3. Claude receives error and tries `rm` without `-rf`
4. Claude reports to user: "セキュリティフックに引っかかってしまったようじゃ"

## Security Configuration

The security hook validates:

### 1. Channel Whitelist
Only allowed channels: `C3YC2P45S` (test channel)

### 2. User Permissions
- **Admin users** (`U3XK7TR1P`): Full access
- **Other users**: Restricted from:
  - Dangerous commands: `rm -rf`, `sudo`, etc.
  - System file writes: `.bashrc`, `.ssh`, `/etc/`

### 3. Tool Monitoring
- `Write/Edit`: Validates file paths
- `Bash`: Scans for dangerous commands

## How It Works

When Claude runs a tool, the hook receives:
- `$SLACK_CHANNEL` - Channel ID
- `$SLACK_USER_ID` - User who triggered the bot
- `$SLACK_MESSAGE_TS` - Current message timestamp
- `$TOOL_INPUT` - Tool parameters (JSON string)

The hook script returns:
- `"permissionDecision": "allow"` - Proceed
- `"permissionDecision": "deny"` + reason - Block with explanation

## Testing

Try these scenarios:

1. **Allowed**: `@bot echo "hello"`
2. **Blocked (non-admin)**: `@bot run: rm -rf /tmp/test`
3. **Blocked (channel)**: Send from non-whitelisted channel
4. **Admin override**: Admin can run restricted commands

## Environment Variables

The bot sets these when launching Claude:
- `SLACK_CHANNEL` - Channel ID
- `SLACK_THREAD_TS` - Thread timestamp
- `SLACK_MESSAGE_TS` - Message timestamp
- `SLACK_USER_ID` - User ID who sent the message
