import { readFileSync } from 'fs';
import { extname } from 'path';
import { config } from 'dotenv';
import { SogniClientWrapper, type ChatMessage } from '../src';

config();

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function resolvePrompt(): string {
  return getArgValue('--prompt') || 'Describe this image in one concise paragraph.';
}

function resolveImageInput(): string {
  const image = getArgValue('--image');
  if (!image) {
    throw new Error('Missing --image <path-or-url>. Supports local files, https URLs, and data URIs.');
  }
  return image;
}

function getMimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

function toImageUrl(imageInput: string): string {
  if (/^(https?:|data:)/i.test(imageInput)) {
    return imageInput;
  }

  const mimeType = getMimeType(imageInput);
  const buffer = readFileSync(imageInput);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function resolveVisionModel(client: SogniClientWrapper): Promise<string> {
  const models = await client.waitForChatModels(15000);
  const preferred = process.env.SOGNI_LLM_MODEL;
  if (preferred && models[preferred] && (models[preferred].workers || 0) > 0) {
    return preferred;
  }

  for (const [modelId, modelInfo] of Object.entries(models)) {
    if ((modelInfo.workers || 0) > 0 && /vision|vlm|qwen3\.5/i.test(modelId)) {
      return modelId;
    }
  }

  for (const [modelId, modelInfo] of Object.entries(models)) {
    if ((modelInfo.workers || 0) > 0) {
      return modelId;
    }
  }

  throw new Error('No LLM models are currently available.');
}

async function main() {
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    throw new Error('Missing SOGNI_USERNAME or SOGNI_PASSWORD in environment.');
  }

  const imageInput = resolveImageInput();
  const prompt = resolvePrompt();
  const imageUrl = toImageUrl(imageInput);

  const client = new SogniClientWrapper({
    // A stable app id (never a new random one per run): the socket recovers this
    // app's projects after a restart, and each new id uses up an app-id registration.
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-llm-chat-vision',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveVisionModel(client);
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ];

    console.log(`Using vision model: ${model}`);
    console.log(`Prompt: ${prompt}`);

    const result = await client.createChatCompletion({
      model,
      messages,
      max_tokens: 300,
      think: false,
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
