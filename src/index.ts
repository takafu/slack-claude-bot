import { App } from '@slack/bolt';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Load prompt files and combine them
 */
function buildPrompt(userMessage: string, hasSession: boolean): string {
  const tasksDir = path.join(__dirname, '..', 'tasks');

  // Load shared Slack API guide
  const slackApiGuide = fs.readFileSync(
    path.join(tasksDir, '_shared', 'slack-api.md'),
    'utf-8'
  );

  // Load task-specific prompt based on session state
  const taskFile = hasSession ? 'thread.md' : 'mention.md';
  const taskPrompt = fs.readFileSync(
    path.join(tasksDir, taskFile),
    'utf-8'
  );

  return `${slackApiGuide}

---

${taskPrompt}

---

## User Message

${userMessage}`;
}

// Environment variables
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN!;

// Session ID storage per thread
const threadSessions = new Map<string, string>();

// Bot user ID (will be set on startup)
let BOT_USER_ID: string;

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
async function callClaude(
  message: string,
  channel: string,
  threadTs: string,
  messageTs: string,
  sessionId?: string
): Promise<ClaudeResponse> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--dangerously-skip-permissions', '--output-format', 'json'];

    // Continue existing session
    if (sessionId) {
      args.push('-r', sessionId);
    }

    args.push(message);

    console.log('Calling Claude with message length:', message.length);

    // Build command - escape each argument with single quotes
    const claudeCommand = ['claude', ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');

    // Use bash directly (script command causes process not to exit)
    const proc = spawn('bash', ['-l', '-c', claudeCommand], {
      stdio: ['ignore', 'pipe', 'pipe'], // Close stdin
      env: {
        ...process.env,
        SLACK_CHANNEL: channel,
        SLACK_THREAD_TS: threadTs,
        SLACK_MESSAGE_TS: messageTs,
      },
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
    // Get existing session
    const existingSession = threadSessions.get(threadKey);

    // Build prompt with instructions
    const prompt = buildPrompt(text, !!existingSession);

    // Call Claude - it will handle all Slack interactions (messages, reactions, etc.)
    const { result, sessionId: newSessionId } = await callClaude(
      prompt,
      event.channel,
      threadTs,
      event.ts, // Current message timestamp
      existingSession
    );

    // Store new session ID
    if (!existingSession && newSessionId) {
      threadSessions.set(threadKey, newSessionId);
      console.log(`New session for ${threadKey}: ${newSessionId}`);
    }

    // Log result (Claude handles posting, so we just log)
    console.log('Claude completed. Result:', result.slice(0, 100));

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

  // Ignore messages from ourselves to prevent infinite loops
  if ('user' in message && message.user === BOT_USER_ID) return;

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
    const messageTs = 'ts' in message ? (message as any).ts : '';

    // Build prompt with instructions
    const prompt = buildPrompt(text, true); // Has session = true for thread replies

    // Call Claude - it will handle all Slack interactions
    const { result } = await callClaude(prompt, message.channel, message.thread_ts!, messageTs, sessionId);

    // Log result
    console.log('Claude completed. Result:', result.slice(0, 100));

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

  // Get bot user ID
  const authResult = await app.client.auth.test({ token: SLACK_BOT_TOKEN });
  BOT_USER_ID = authResult.user_id as string;

  console.log('Slack Claude Bot is running!');
  console.log('Bot Token:', SLACK_BOT_TOKEN ? 'Set' : 'Missing');
  console.log('App Token:', SLACK_APP_TOKEN ? 'Set' : 'Missing');
  console.log('Bot User ID:', BOT_USER_ID);
})();
