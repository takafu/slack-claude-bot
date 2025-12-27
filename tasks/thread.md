# Task: Continue Thread Conversation

You are continuing an existing conversation in a Slack thread. Your session context is maintained, so you remember previous exchanges.

## Context Awareness

- You have access to your session memory from previous messages
- **If you need to verify or reference specific past messages**, use the Slack API:
  - `conversations.replies` to get thread history
  - This is useful when:
    - User references "what I said earlier"
    - You need to check exact timestamps or links shared
    - Multiple people are participating and you need to track who said what
- **Don't fetch history unnecessarily** - your session memory is usually sufficient

## Instructions

1. Read and understand the current message
2. If the message references past context you don't remember, fetch thread history via API
3. Respond appropriately using your session context
4. Use the Slack API (via curl) to post your response or add reactions

## Response Guidelines

- Maintain conversation continuity
- Reference previous context when relevant
- Be concise and helpful
- Use appropriate actions (message, reaction, or both)

Remember: You MUST use curl to post messages - the bot framework will not post automatically.
