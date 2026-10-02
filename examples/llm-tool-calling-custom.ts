import { config } from 'dotenv';
import {
  SogniClientWrapper,
  type ChatMessage,
  type ToolCall,
  type ToolDefinition,
} from '../src';

config();

const tools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_time',
      description: 'Get current time in a requested timezone.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'IANA timezone string such as UTC or America/New_York.',
          },
        },
        required: ['timezone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_numbers',
      description: 'Add two numbers and return the sum.',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
    },
  },
];

function getPrompt(): string {
  return (
    process.argv.slice(2).join(' ').trim() ||
    'Tell me the current UTC time, add 19 and 23, then summarize both results.'
  );
}

function parseToolArgs(toolCall: ToolCall): Record<string, unknown> {
  try {
    return JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return {};
  }
}

function executeLocalTool(toolCall: ToolCall): string {
  const args = parseToolArgs(toolCall);

  if (toolCall.function.name === 'get_time') {
    const timezone = typeof args.timezone === 'string' && args.timezone ? args.timezone : 'UTC';
    const value = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false });
    return JSON.stringify({ timezone, value });
  }

  if (toolCall.function.name === 'add_numbers') {
    const a = typeof args.a === 'number' ? args.a : Number(args.a || 0);
    const b = typeof args.b === 'number' ? args.b : Number(args.b || 0);
    return JSON.stringify({ a, b, sum: a + b });
  }

  return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
}

async function resolveChatModel(client: SogniClientWrapper): Promise<string> {
  const models = await client.waitForChatModels(15000);
  const preferred = process.env.SOGNI_LLM_MODEL;
  if (preferred && models[preferred] && (models[preferred].workers || 0) > 0) {
    return preferred;
  }

  for (const [modelId, modelInfo] of Object.entries(models)) {
    if ((modelInfo.workers || 0) > 0) {
      return modelId;
    }
  }

  const first = Object.keys(models)[0];
  if (!first) {
    throw new Error('No LLM models are currently available.');
  }
  return first;
}

async function main() {
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    throw new Error('Missing SOGNI_USERNAME or SOGNI_PASSWORD in environment.');
  }

  const client = new SogniClientWrapper({
    // A stable app id (never a new random one per run): the socket recovers this
    // app's projects after a restart, and each new id uses up an app-id registration.
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-llm-tool-calling-custom',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveChatModel(client);
    const prompt = getPrompt();
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    console.log(`Using chat model: ${model}`);
    console.log(`Prompt: ${prompt}\n`);

    for (let turn = 0; turn < 6; turn++) {
      const result = await client.createChatCompletion({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 512,
        tokenType: 'spark',
      });

      const toolCalls = result.tool_calls || [];
      console.log(`Assistant turn ${turn + 1}:`);
      if (result.content) {
        console.log(result.content);
      }

      if (toolCalls.length === 0) {
        console.log('\nFinal usage:', result.usage);
        return;
      }

      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const output = executeLocalTool(toolCall);
        console.log(`Tool ${toolCall.function.name} -> ${output}`);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: output,
        });
      }

      console.log('');
    }

    throw new Error('Reached max tool-calling turns without final completion.');
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
