import { config } from 'dotenv';
import { SogniClientWrapper } from '../src';

config();

function resolvePrompt(): string {
  return process.argv.slice(2).join(' ').trim() || 'Give me a concise overview of image diffusion models.';
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
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-llm-chat-streaming',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveChatModel(client);
    const prompt = resolvePrompt();

    console.log(`Using chat model: ${model}`);
    console.log(`Prompt: ${prompt}\n`);

    const stream = await client.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      stream: true,
      tokenType: 'spark',
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
      }
    }

    const final = stream.finalResult;
    if (final?.usage) {
      console.log('\n\nUsage:', final.usage);
    } else {
      console.log('\n');
    }
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
