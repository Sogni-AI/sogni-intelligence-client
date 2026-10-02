import { config } from 'dotenv';
import { SogniClientWrapper } from '../src';

config();

function resolvePrompt(): string {
  return process.argv.slice(2).join(' ').trim() || 'Explain the Sogni Supernet in one short paragraph.';
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
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-llm-chat-basic',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveChatModel(client);
    const prompt = resolvePrompt();

    console.log(`Using chat model: ${model}`);
    console.log(`Prompt: ${prompt}`);

    const result = await client.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      tokenType: 'spark',
    });

    console.log('\nResponse:\n');
    console.log(result.content);
    console.log('\nUsage:', result.usage);
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
