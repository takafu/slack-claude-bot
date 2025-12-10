import { App } from '@slack/bolt';
import { spawn } from 'child_process';

/**
 * Convert Markdown to Slack mrkdwn format
 */
function toSlackMarkdown(text: string): string {
  return text
    // Headers (## or ###) to bold
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // **bold** to *bold*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // [text](url) to <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // List items: - to bullet
    .replace(/^(\s*)-\s+/gm, '$1• ');
}

// Environment variables
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN!;

// Session ID storage per thread
const threadSessions = new Map<string, string>();

// Initialize Slack App (Socket Mode)
const app = new App({
  token: SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: SLACK_APP_TOKEN,
});

interface ClaudeResponse {
  result: string;
  sessionId?: string;
}

/**
 * Call Claude Code CLI with JSON output
 */
async function callClaude(message: string, sessionId?: string): Promise<ClaudeResponse> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--dangerously-skip-permissions', '--output-format', 'json'];

    // Continue existing session
    if (sessionId) {
      args.push('-r', sessionId);
    }

    args.push(message);

    console.log('Calling Claude with args:', args);

    // Use `script` command to emulate TTY for Claude CLI
    const claudeCommand = ['claude', ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    const proc = spawn('script', ['-q', '-c', `bash -l -c "${claudeCommand}"`, '/dev/null'], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      console.log('Claude exited with code:', code);
      console.log('stdout:', stdout.slice(0, 200));
      console.log('stderr:', stderr);
      if (code === 0) {
        try {
          // Remove ANSI escape codes
          const cleanOutput = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
          // Find valid JSON line containing "result"
          const lines = cleanOutput.split('\n');
          let json = null;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{') && trimmed.includes('"result"')) {
              try {
                json = JSON.parse(trimmed);
                break;
              } catch {
                continue;
              }
            }
          }
          if (json) {
            resolve({
              result: json.result || '',
              sessionId: json.session_id,
            });
          } else {
            // Return as plain text if no JSON found
            resolve({ result: cleanOutput });
          }
        } catch (e) {
          // Return as plain text on parse failure
          console.error('JSON parse error:', e);
          resolve({ result: stdout.trim() });
        }
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate thread key for session storage
 */
function getThreadKey(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

/**
 * Handle @mentions
 */
app.event('app_mention', async ({ event, say }) => {
  const threadTs = event.thread_ts || event.ts;
  const threadKey = getThreadKey(event.channel, threadTs);

  // Remove mention from message
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!text) {
    await say({ text: 'Please enter a message', thread_ts: threadTs });
    return;
  }

  try {
    // Show thinking indicator
    const thinkingMsg = await say({ text: 'Thinking... :thinking_face:', thread_ts: threadTs });

    // Get existing session
    const existingSession = threadSessions.get(threadKey);

    // Call Claude
    const { result, sessionId: newSessionId } = await callClaude(text, existingSession);

    // Store new session ID
    if (!existingSession && newSessionId) {
      threadSessions.set(threadKey, newSessionId);
      console.log(`New session for ${threadKey}: ${newSessionId}`);
    }

    // Convert to Slack mrkdwn
    console.log('Raw result from Claude:', JSON.stringify(result));
    const slackText = toSlackMarkdown(result);
    console.log('After toSlackMarkdown:', JSON.stringify(slackText));

    // Reply (split if too long)
    const maxLength = 3900; // Slack limit is 4000 chars
    if (slackText.length <= maxLength) {
      await say({ text: slackText, thread_ts: threadTs });
    } else {
      // Split into chunks
      for (let i = 0; i < slackText.length; i += maxLength) {
        const chunk = slackText.slice(i, i + maxLength);
        await say({ text: chunk, thread_ts: threadTs });
      }
    }

    // Delete thinking message
    try {
      await app.client.chat.delete({
        token: SLACK_BOT_TOKEN,
        channel: event.channel,
        ts: thinkingMsg.ts as string,
      });
    } catch {
      // Continue even if deletion fails
    }

  } catch (error) {
    console.error('Error:', error);
    await say({
      text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      thread_ts: threadTs
    });
  }
});

/**
 * Handle thread messages (without mention)
 */
app.message(async ({ message, say }) => {
  // Only process messages in threads
  if (!('thread_ts' in message) || !message.thread_ts) return;

  // Ignore bot messages
  if ('bot_id' in message) return;

  // Get message text (remove mentions)
  const rawText = 'text' in message ? message.text : '';
  if (!rawText) return;

  // If message has mention, let app_mention handle it
  if (/<@[A-Z0-9]+>/.test(rawText)) return;

  const text = rawText.trim();

  const threadKey = getThreadKey(message.channel, message.thread_ts);

  // Only respond if session exists for this thread
  const sessionId = threadSessions.get(threadKey);
  if (!sessionId) return;

  try {
    const thinkingMsg = await say({ text: 'Thinking... :thinking_face:', thread_ts: message.thread_ts });

    const { result } = await callClaude(text, sessionId);
    const slackText = toSlackMarkdown(result);

    const maxLength = 3900;
    if (slackText.length <= maxLength) {
      await say({ text: slackText, thread_ts: message.thread_ts });
    } else {
      for (let i = 0; i < slackText.length; i += maxLength) {
        const chunk = slackText.slice(i, i + maxLength);
        await say({ text: chunk, thread_ts: message.thread_ts });
      }
    }

    try {
      await app.client.chat.delete({
        token: SLACK_BOT_TOKEN,
        channel: message.channel,
        ts: thinkingMsg.ts as string,
      });
    } catch {
      // Continue even if deletion fails
    }

  } catch (error) {
    console.error('Error:', error);
    await say({
      text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      thread_ts: message.thread_ts
    });
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('Slack Claude Bot is running!');
  console.log('Bot Token:', SLACK_BOT_TOKEN ? 'Set' : 'Missing');
  console.log('App Token:', SLACK_APP_TOKEN ? 'Set' : 'Missing');
})();
