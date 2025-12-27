# Slack API Integration Guide

You have direct access to Slack API via environment variables. Use the Bash tool with curl to interact with Slack.

## Available Environment Variables

- `$SLACK_BOT_TOKEN` - Bot User OAuth Token (xoxb-...)
- `$SLACK_CHANNEL` - Current channel ID (e.g., C08UB7LTVAX)
- `$SLACK_THREAD_TS` - Thread timestamp (e.g., 1234567890.123456)

## Common API Calls

### Post a Message

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "'"${SLACK_CHANNEL}"'",
    "thread_ts": "'"${SLACK_THREAD_TS}"'",
    "text": "Your message here"
  }'
```

### Add Reaction

```bash
curl -X POST https://slack.com/api/reactions.add \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "'"${SLACK_CHANNEL}"'",
    "timestamp": "'"${SLACK_THREAD_TS}"'",
    "name": "thumbsup"
  }'
```

### Post Multiple Messages

You can call the API multiple times to post several messages:

```bash
# First message
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"channel":"'"${SLACK_CHANNEL}"'","thread_ts":"'"${SLACK_THREAD_TS}"'","text":"Part 1"}'

# Second message
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"channel":"'"${SLACK_CHANNEL}"'","thread_ts":"'"${SLACK_THREAD_TS}"'","text":"Part 2"}'
```

## Slack Markdown (mrkdwn)

Use Slack's mrkdwn format for formatting:

- `*bold*` - Bold text
- `_italic_` - Italic text
- `~strike~` - Strikethrough
- `` `code` `` - Inline code
- ` ```code block``` ` - Code block
- `<url|text>` - Hyperlink
- `• item` - Bullet points

## Decision Making

You have full autonomy to decide:

- **Reply or not**: If the message doesn't need a response, you can just add a reaction or do nothing
- **How to reply**: One message, multiple messages, or just a reaction
- **What actions to take**: Post messages, add reactions, or any combination

## Important Notes

- Always post messages to the thread (use `thread_ts`)
- Check curl response for errors: `"ok": true` means success
- The bot framework does NOT automatically post your responses - you must use curl yourself
- If you don't call the API, nothing will be posted to Slack
