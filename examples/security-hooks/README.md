# Test Workspace - Slack Bot Configuration

This workspace demonstrates Slack bot integration with security hooks.

## Files

- `slack.md` - Bot personality configuration (elderly Minecraft enthusiast)
- `settings.local.json` - Security hooks (not committed to git)
- `hooks/slack-security.sh` - Security validation script

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
