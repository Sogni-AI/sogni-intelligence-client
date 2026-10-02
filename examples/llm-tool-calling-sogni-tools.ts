import { config } from 'dotenv';
import {
  SogniClientWrapper,
  SogniTools,
  isSogniToolCall,
  parseToolCallArguments,
  type ChatMessage,
  type ModelInfo,
  type ToolCall,
} from '../src';

config();

function getPrompt(): string {
  return (
    process.argv
      .slice(2)
      .filter((arg) => arg !== '--dry-run')
      .join(' ')
      .trim() || 'Create a cinematic sunset image and give me the generation URL.'
  );
}

function isDryRun(): boolean {
  return process.argv.includes('--dry-run');
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectModel(models: ModelInfo[], media: 'image' | 'video' | 'audio', requested?: unknown): string {
  if (typeof requested === 'string' && requested.trim()) {
    return requested;
  }

  const preferred = models.find((m) => m.media === media && m.workerCount > 0);
  if (preferred) {
    return preferred.id;
  }

  const fallback = models.find((m) => m.media === media);
  if (!fallback) {
    throw new Error(`No ${media} model available for this tool call.`);
  }
  return fallback.id;
}

async function executeSogniTool(
  client: SogniClientWrapper,
  models: ModelInfo[],
  toolCall: ToolCall,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const args = parseToolCallArguments(toolCall);

  if (!isSogniToolCall(toolCall)) {
    return { error: `Unsupported tool: ${toolCall.function.name}` };
  }

  if (toolCall.function.name === 'generate_image') {
    const modelId = selectModel(models, 'image', args.model);
    const positivePrompt = asString(args.prompt, 'An abstract composition');
    const negativePrompt = asString(args.negative_prompt, '');
    const width = asNumber(args.width, 1024);
    const height = asNumber(args.height, 1024);
    const steps = asNumber(args.steps, 4);
    const seed = asNumber(args.seed, -1);

    if (dryRun) {
      return {
        tool: toolCall.function.name,
        dryRun: true,
        modelId,
        url: 'https://example.com/dry-run-image.png',
      };
    }

    const result = await client.createImageProject({
      modelId,
      positivePrompt,
      negativePrompt,
      width,
      height,
      steps,
      seed,
      numberOfMedia: 1,
      tokenType: 'spark',
      network: 'fast',
      waitForCompletion: true,
    });

    return {
      tool: toolCall.function.name,
      modelId,
      url: result.imageUrls?.[0] || null,
      projectId: result.project.id,
    };
  }

  if (toolCall.function.name === 'generate_video') {
    const modelId = selectModel(
      models,
      'video',
      typeof args.model === 'string' ? args.model : 'wan_v2.2-14b-fp8_t2v_lightx2v'
    );
    const positivePrompt = asString(args.prompt, 'A calm ocean at golden hour');
    const negativePrompt = asString(args.negative_prompt, '');
    const width = asNumber(args.width, 640);
    const height = asNumber(args.height, 640);
    const duration = asNumber(args.duration, 5);
    const fps = asNumber(args.fps, 16);
    const seed = asNumber(args.seed, -1);

    if (dryRun) {
      return {
        tool: toolCall.function.name,
        dryRun: true,
        modelId,
        url: 'https://example.com/dry-run-video.mp4',
      };
    }

    const result = await client.createVideoProject({
      modelId,
      positivePrompt,
      negativePrompt,
      width,
      height,
      duration,
      fps,
      seed,
      numberOfMedia: 1,
      tokenType: 'spark',
      network: 'fast',
      waitForCompletion: true,
      timeout: 300000,
    });

    return {
      tool: toolCall.function.name,
      modelId,
      url: result.videoUrls?.[0] || null,
      projectId: result.project.id,
    };
  }

  if (toolCall.function.name === 'sogni_generate_music') {
    const modelId = selectModel(
      models,
      'audio',
      typeof args.model === 'string' ? args.model : 'ace_step_1.5_xl_turbo'
    );
    const positivePrompt = asString(args.prompt, 'A mellow electronic ambient track');
    const duration = asNumber(args.duration, 30);
    const bpm = asNumber(args.bpm, 120);
    const keyscale = asString(args.keyscale, 'C major');
    const timesignature = asString(args.timesignature, '4') as '2' | '3' | '4';
    const outputFormat = asString(args.output_format, 'mp3') as 'mp3' | 'wav' | 'flac';
    const seed = asNumber(args.seed, -1);

    if (dryRun) {
      return {
        tool: toolCall.function.name,
        dryRun: true,
        modelId,
        url: 'https://example.com/dry-run-audio.mp3',
      };
    }

    const result = await client.createAudioProject({
      modelId,
      positivePrompt,
      duration,
      bpm,
      keyscale,
      timesignature,
      outputFormat,
      seed,
      numberOfMedia: 1,
      tokenType: 'spark',
      network: 'fast',
      waitForCompletion: true,
      timeout: 300000,
    });

    return {
      tool: toolCall.function.name,
      modelId,
      url: result.audioUrls?.[0] || null,
      projectId: result.project.id,
    };
  }

  return { error: `Unhandled Sogni tool: ${toolCall.function.name}` };
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

  const dryRun = isDryRun();
  const prompt = getPrompt();

  const client = new SogniClientWrapper({
    // A stable app id (never a new random one per run): the socket recovers this
    // app's projects after a restart, and each new id uses up an app-id registration.
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-llm-tool-calling-sogni-tools',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const llmModel = await resolveChatModel(client);
    const mediaModels = await client.getAvailableModels({ minWorkers: 1 });
    const tools = SogniTools.all;

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    console.log(`Using LLM model: ${llmModel}`);
    console.log(`Dry run: ${dryRun}`);
    console.log(`Prompt: ${prompt}\n`);

    for (let turn = 0; turn < 6; turn++) {
      const result = await client.createChatCompletion({
        model: llmModel,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 768,
        tokenType: 'spark',
      });

      const toolCalls = result.tool_calls || [];
      if (result.content) {
        console.log(`Assistant turn ${turn + 1}: ${result.content}`);
      }

      if (toolCalls.length === 0) {
        console.log('\nNo more tool calls. Final usage:', result.usage);
        return;
      }

      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const toolResult = await executeSogniTool(client, mediaModels, toolCall, dryRun);
        console.log(`Tool ${toolCall.function.name} ->`, toolResult);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(toolResult),
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
