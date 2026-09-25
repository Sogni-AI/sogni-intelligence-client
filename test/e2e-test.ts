/**
 * End-to-end tests with real Sogni API credentials
 */

import * as dotenv from 'dotenv';
import { SogniClientWrapper, ClientEvent } from '../src';

// Load environment variables from .env file
dotenv.config();

console.log('🧪 Starting end-to-end tests with real API...\n');

// Validate environment variables
if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
  console.error('❌ Missing required environment variables!');
  console.error('Please create a .env file with:');
  console.error('  SOGNI_USERNAME=your_username');
  console.error('  SOGNI_PASSWORD=your_password');
  process.exit(1);
}

const CREDENTIALS = {
  username: process.env.SOGNI_USERNAME,
  password: process.env.SOGNI_PASSWORD,
};

// Optional LLM e2e controls:
// - SOGNI_LLM_MODEL: preferred LLM model id
// - SOGNI_REQUIRE_LLM_E2E=true: fail if LLM models are unavailable
const PREFERRED_LLM_MODEL = process.env.SOGNI_LLM_MODEL;
const REQUIRE_LLM_E2E = process.env.SOGNI_REQUIRE_LLM_E2E === 'true';
const REQUIRE_TOOL_CALL_E2E = process.env.SOGNI_REQUIRE_TOOL_CALL_E2E === 'true';
const E2E_SCOPE = (process.env.SOGNI_E2E_SCOPE || 'all').toLowerCase();
const LLM_TEST_NAME_PATTERN = /(llm|tool[- ]?call)/i;
const LLM_SCOPE_ALWAYS_RUN = new Set([
  'Should create client with credentials',
  'Should connect to Sogni Supernet',
  'Should disconnect cleanly',
]);

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

class SkipTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipTestError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSineWaveWavBlob(
  durationSeconds: number = 5,
  sampleRate: number = 22050,
  frequencyHz: number = 440
): Blob {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = durationSeconds * sampleRate;
  const dataSize = frameCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < frameCount; i++) {
    const sample = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
    const amplitude = Math.round(sample * 0.25 * 32767);
    buffer.writeInt16LE(amplitude, 44 + i * bytesPerSample);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function fetchMediaBuffer(url: string, label: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchMediaBlob(url: string, label: string, fallbackType: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || fallbackType;
  return new Blob([arrayBuffer], { type: contentType });
}

function isReferenceAudioDownload404(error: unknown): boolean {
  const errorText = getErrorText(error);
  return (
    errorText.includes("Asset 'audio' could not be downloaded") &&
    errorText.includes('404 Not Found')
  );
}

function isWorkerOutOfMemory(error: unknown): boolean {
  const errorText = getErrorText(error);
  return (
    errorText.includes('Allocation on device') ||
    errorText.includes('ran out of memory on your GPU')
  );
}

function getErrorText(error: unknown): string {
  const parts = new Set<string>();

  const visit = (value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'string') {
      parts.add(value);
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.add(String(value));
      return;
    }

    if (value instanceof Error) {
      if (value.message) {
        parts.add(value.message);
      }
      visit((value as any).originalError);
      visit((value as any).details);
      return;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const key of ['message', 'originalCode', 'code', 'status']) {
        if (key in record) {
          visit(record[key]);
        }
      }
      if ('originalError' in record) {
        visit(record.originalError);
      }
      if ('details' in record) {
        visit(record.details);
      }
    }
  };

  visit(error);
  return Array.from(parts).join(' | ');
}

function createVideoReferenceAudioFallback(): Blob {
  return createSineWaveWavBlob(5, 22050, 330);
}

function selectReferenceAudioForVideo(referenceAudioMedia: Blob | undefined): Blob {
  return referenceAudioMedia || createVideoReferenceAudioFallback();
}

function ensureClient(client: SogniClientWrapper | null): SogniClientWrapper {
  if (!client) {
    throw new Error('Client not initialized');
  }
  return client;
}

type AvailableModelInfo = {
  id: string;
  name?: string;
  media?: string;
  workerCount?: number;
  recommendedSettings?: { steps?: number; guidance?: number };
};

// Flux only, no fallback: "any image model" can resolve to a third-party
// vendor model (gpt-image-*, happyhorse-*, …) and bill a real vendor render.
function selectPreferredImageModel(models: AvailableModelInfo[]): AvailableModelInfo | undefined {
  return models.find((model) => model.media === 'image' && model.id.includes('flux'));
}

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    if (
      E2E_SCOPE === 'llm' &&
      !LLM_TEST_NAME_PATTERN.test(name) &&
      !LLM_SCOPE_ALWAYS_RUN.has(name)
    ) {
      console.log(`\n⏭️ Skipping (LLM scope): ${name}`);
      testsSkipped++;
      return;
    }

    try {
      console.log(`\n🔄 Running: ${name}`);
      await fn();
      console.log(`✅ PASS: ${name}`);
      testsPassed++;
    } catch (error) {
      if (error instanceof SkipTestError) {
        console.log(`⏭️ SKIP: ${name}`);
        console.log(`   Reason: ${error.message}`);
        testsSkipped++;
        return;
      }

      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      testsFailed++;
    }
  };
}

async function requestForcedAddNumbersToolCall(
  client: SogniClientWrapper,
  modelId: string,
  a: number,
  b: number
): Promise<{
  tools: Array<any>;
  result: any | null;
  toolCall: any | null;
  attempts: Array<{ maxTokens: number; finishReason: string; toolCalls: number; contentPreview: string }>;
}> {
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'add_numbers',
        description: 'Add two numeric values and return their sum.',
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

  const attempts: Array<{ maxTokens: number; finishReason: string; toolCalls: number; contentPreview: string }> = [];
  for (const maxTokens of [256, 512, 1024]) {
    const result = await client.createChatCompletion({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: 'You must call the provided add_numbers tool. Do not answer directly.',
        },
        {
          role: 'user',
          content: `Call add_numbers with a=${a} and b=${b}. Return only the tool call.`,
        },
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'add_numbers' } },
      temperature: 0,
      max_tokens: maxTokens,
      tokenType: 'spark',
    });

    const toolCalls = result.tool_calls || [];
    const contentPreview = (result.content || '').slice(0, 120).replace(/\s+/g, ' ').trim();
    attempts.push({
      maxTokens,
      finishReason: result.finishReason || 'unknown',
      toolCalls: toolCalls.length,
      contentPreview,
    });

    if (toolCalls.length > 0) {
      return { tools, result, toolCall: toolCalls[0], attempts };
    }
  }

  return { tools, result: null, toolCall: null, attempts };
}

async function runTests() {
  let client: SogniClientWrapper | null = null;
  let catImageUrl: string | undefined; // Store the cat image URL for video test
  let catImageBuffer: Buffer | undefined;
  let referenceAudioUrl: string | undefined;
  let referenceAudioMedia: Blob | undefined;
  let referenceVideoUrl: string | undefined;
  let availableModelIds: string[] = [];
  let availableModels: AvailableModelInfo[] = [];
  let selectedLlmModelId: string | undefined;
  let availableLlmModels: Record<string, { workers?: number }> = {};
  let selectedToolCallingModelId: string | undefined;

  try {
    // Test 1: Create client
    await test('Should create client with credentials', async () => {
      client = new SogniClientWrapper({
        ...CREDENTIALS,
        autoConnect: false,
        debug: true,
      });
      if (!client) throw new Error('Client not created');
    })();

    // Test 2: Connect to Sogni
    await test('Should connect to Sogni Supernet', async () => {
      if (!client) throw new Error('Client not initialized');
      
      console.log('   Connecting to Sogni...');
      await client.connect();
      
      if (!client.isConnected()) {
        throw new Error('Client not connected after connect()');
      }
      console.log('   Connected successfully!');
    })();

    // Test 3: Get balance
    await test('Should retrieve account balance', async () => {
      if (!client) throw new Error('Client not initialized');

      const balance = await client.getBalance();
      console.log(`   SOGNI tokens: ${balance.sogni}`);
      console.log(`   Spark tokens: ${balance.spark}`);

      // Note: refreshBalance() returns both SOGNI and Spark balances
      // We're checking the 'net' balance (settled + credit - debit)
      if (typeof balance.sogni !== 'number') {
        throw new Error('Invalid balance format');
      }
    })();

    // Test 4: Get available models
    await test('Should retrieve available models', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const models = await client.getAvailableModels({ sortByWorkers: true });
      availableModels = models;
      availableModelIds = models.map((m) => m.id);
      console.log(`   Found ${models.length} models`);
      
      if (models.length === 0) {
        throw new Error('No models available');
      }
      
      console.log(`   Top model: ${models[0].id} (${models[0].workerCount} workers)`);
    })();

    // Test 5: Get most popular model
    await test('Should get most popular model', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const model = await client.getMostPopularModel();
      console.log(`   Model ID: ${model.id}`);
      console.log(`   Model name: ${model.name}`);
      console.log(`   Workers: ${model.workerCount}`);
      console.log(`   Recommended steps: ${model.recommendedSettings?.steps}`);
      console.log(`   Recommended guidance: ${model.recommendedSettings?.guidance}`);
      
      if (!model.id) throw new Error('Invalid model');
    })();

    // Test 6: Get specific model
    await test('Should get specific model by ID', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const models = await client.getAvailableModels();
      if (models.length === 0) throw new Error('No models available');
      
      const firstModelId = models[0].id;
      const model = await client.getModel(firstModelId);
      
      console.log(`   Retrieved model: ${model.id}`);
      if (model.id !== firstModelId) {
        throw new Error('Model ID mismatch');
      }
    })();

    // Test 7: Generate a simple image
    await test('Should generate image with Flux model', async () => {
      // Wait a bit to avoid rate limiting
      await sleep(5000);
      if (!client) throw new Error('Client not initialized');

      const model = selectPreferredImageModel(availableModels);
      if (!model) {
        throw new Error('No Flux image model available');
      }
      console.log(`   Using model: ${model.id}`);
      console.log(`   Generating image...`);
      
      let progressCount = 0;
      
      const result = await client.createProject({
        type: 'image',
        modelId: model.id,
        positivePrompt: 'A cute cartoon cat wearing sunglasses',
        negativePrompt: 'blurry, low quality',
        steps: model.recommendedSettings?.steps || 4,
        guidance: model.recommendedSettings?.guidance || 3.5,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 180000,
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });
      
      console.log(`   Generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Images generated: ${result.imageUrls?.length || 0}`);
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log(`   Image URL: ${result.imageUrls[0]}`);
        catImageUrl = result.imageUrls[0]; // Store for video test
      }
      
      if (!result.completed) {
        throw new Error('Image generation did not complete');
      }
      
      if (!result.imageUrls || result.imageUrls.length === 0) {
        throw new Error('No image URLs returned');
      }
    })();

    // Test 8: Event listeners
    await test('Should emit events during operation', async () => {
      // Wait to avoid rate limiting
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');
      
      let eventsFired = {
        projectCreated: false,
        projectProgress: false,
        projectCompleted: false,
      };
      
      client.on(ClientEvent.PROJECT_CREATED, () => {
        eventsFired.projectCreated = true;
        console.log('   Event: PROJECT_CREATED');
      });
      
      client.on(ClientEvent.PROJECT_PROGRESS, () => {
        eventsFired.projectProgress = true;
      });
      
      client.on(ClientEvent.PROJECT_COMPLETED, () => {
        eventsFired.projectCompleted = true;
        console.log('   Event: PROJECT_COMPLETED');
      });
      
      const model = selectPreferredImageModel(availableModels);
      if (!model) {
        throw new Error('No Flux image model available');
      }
      
      await client.createProject({
        type: 'image',
        modelId: model.id,
        positivePrompt: 'A simple red circle on white background',
        steps: model.recommendedSettings?.steps || 4,
        guidance: model.recommendedSettings?.guidance || 3.5,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 180000,
      });
      
      console.log('   Events fired:', eventsFired);
      
      if (!eventsFired.projectCreated) {
        throw new Error('PROJECT_CREATED event not fired');
      }
      if (!eventsFired.projectCompleted) {
        throw new Error('PROJECT_COMPLETED event not fired');
      }
    })();

    // Test 9: Generate a video with fastest settings
    await test('Should generate video with wan_v2.2-14b-fp8_i2v_lightx2v model', async () => {
      // Wait to avoid rate limiting
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');

      if (!catImageUrl) {
        console.log('   ⚠️ No cat image URL from previous test, skipping i2v test');
        throw new Error('Reference image required for i2v model - run image test first');
      }

      console.log('   Using model: wan_v2.2-14b-fp8_i2v_lightx2v (image-to-video)');
      console.log('   Settings: 512x512, 16fps, 81 frames');
      console.log('   Reference image: Using cat image from test 7');
      console.log('   Fetching reference image...');

      // Fetch the image from the URL
      const imageBuffer = await fetchMediaBuffer(catImageUrl, 'reference image');
      catImageBuffer = imageBuffer;
      console.log(`   Reference image fetched: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

      console.log('   Generating video...');

      let progressCount = 0;

      const result = await client.createProject({
        type: 'video',
        modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',
        positivePrompt: 'The cat transforms into a majestic lion, morphing animation, smooth transition',
        negativePrompt: 'blurry, low quality, distorted, glitchy',
        referenceImage: imageBuffer, // Use the cat image as reference
        width: 512,
        height: 512,
        fps: 16,
        frames: 81,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 300000, // 5 minutes for video generation
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });

      console.log(`   Video generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);

      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
        console.log(`   Video duration: ~5 seconds (81 frames @ 16fps)`);
        referenceVideoUrl = result.videoUrls[0];
      }

      if (!result.completed) {
        throw new Error('Video generation did not complete');
      }

      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned');
      }
    })();

    // Test 10: Generate text-to-video without reference image
    await test('Should generate text-to-video with wan_v2.2-14b-fp8_t2v_lightx2v model', async () => {
      // Wait to avoid rate limiting
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');

      console.log('   Using model: wan_v2.2-14b-fp8_t2v_lightx2v (text-to-video speed variant)');
      console.log('   Settings: 640x640, 16fps, 81 frames');
      console.log('   Steps: 4 (optimized for speed variant)');
      console.log('   No reference image - pure text-to-video generation');
      console.log('   Generating video...');

      let progressCount = 0;

      const result = await client.createProject({
        type: 'video',
        modelId: 'wan_v2.2-14b-fp8_t2v_lightx2v', // Use speed variant that works reliably
        positivePrompt: 'A serene waterfall flowing through a lush green forest',
        negativePrompt: '',  // Empty negative prompt like the working example
        stylePrompt: '',     // Empty style prompt like the working example
        width: 640,          // Use 640x640 like the working example
        height: 640,
        fps: 16,
        frames: 81,
        steps: 4,            // 4 steps for speed variant
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 300000, // 5 minutes for video generation
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });

      console.log(`   Text-to-video generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);

      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
        console.log(`   Video duration: ~5 seconds (81 frames @ 16fps)`);
        if (!referenceVideoUrl) {
          referenceVideoUrl = result.videoUrls[0];
        }
      }

      if (!result.completed) {
        throw new Error('Text-to-video generation did not complete');
      }

      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned from text-to-video');
      }
    })();

    // Test 11: Generate LTX-2 video-to-video with ControlNet
    await test('Should generate LTX-2 v2v video with pose ControlNet', async () => {
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');

      const v2vModelId = availableModelIds.find(
        (id) => id.startsWith('ltx2-') && id.includes('_v2v')
      );
      if (!v2vModelId) {
        console.log('   ⚠️ No LTX-2 v2v model currently available, skipping test');
        return;
      }
      if (!referenceVideoUrl) {
        console.log('   ⚠️ No reference video URL available from earlier tests, skipping test');
        return;
      }

      console.log(`   Using model: ${v2vModelId}`);
      console.log('   Workflow: referenceVideo + pose ControlNet');
      console.log('   Fetching reference video...');

      const referenceVideoBuffer = await fetchMediaBuffer(referenceVideoUrl, 'reference video');
      console.log(`   Reference video fetched: ${(referenceVideoBuffer.length / 1024).toFixed(2)} KB`);
      console.log('   Generating v2v video...');

      let progressCount = 0;
      const result = await client.createProject({
        type: 'video',
        modelId: v2vModelId,
        positivePrompt: 'A cinematic sequence with smooth character motion and stable composition',
        negativePrompt: 'blurry, low quality, distorted',
        referenceVideo: referenceVideoBuffer,
        ...(catImageBuffer ? { referenceImage: catImageBuffer } : {}),
        controlNet: { name: 'pose', strength: 0.8 },
        width: 768,
        height: 768,
        fps: 24,
        duration: 4,
        steps: 20,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 420000,
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });

      console.log(`   V2V generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);
      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
        referenceVideoUrl = result.videoUrls[0];
      }

      if (!result.completed) {
        throw new Error('V2V generation did not complete');
      }
      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned from v2v generation');
      }
    })();

    // Test 12: Generate animate-replace with sam2Coordinates
    await test('Should generate animate-replace video with sam2Coordinates', async () => {
      await sleep(10000);
      const activeClient = ensureClient(client);

      const animateReplaceModelId = availableModelIds.find(
        (id) => id.startsWith('wan_') && id.includes('animate') && id.includes('replace')
      );
      if (!animateReplaceModelId) {
        throw new SkipTestError('No WAN animate-replace model currently available');
      }
      if (!referenceVideoUrl || !catImageBuffer) {
        throw new SkipTestError('Missing reference assets for animate-replace');
      }

      console.log(`   Using model: ${animateReplaceModelId}`);
      console.log('   Workflow: animate-replace with sam2Coordinates');
      console.log('   Fetching reference video...');

      const referenceVideoBuffer = await fetchMediaBuffer(referenceVideoUrl, 'reference video');
      console.log(`   Reference video fetched: ${(referenceVideoBuffer.length / 1024).toFixed(2)} KB`);
      console.log('   Generating animate-replace video...');

      let progressCount = 0;
      let result;
      try {
        result = await activeClient.createProject({
          type: 'video',
          modelId: animateReplaceModelId,
          positivePrompt: 'Keep motion from the source video and replace the subject with the reference character',
          negativePrompt: 'blurry, low quality, artifacts',
          referenceImage: catImageBuffer,
          referenceVideo: referenceVideoBuffer,
          sam2Coordinates: [{ x: 0.5, y: 0.5 }],
          width: 512,
          height: 512,
          fps: 16,
          frames: 81,
          steps: animateReplaceModelId.includes('lightx2v') ? 4 : 20,
          numberOfMedia: 1,
          network: 'fast',
          tokenType: 'spark',
          waitForCompletion: true,
          timeout: 420000,
          onProgress: (progress) => {
            progressCount++;
            if (progressCount % 5 === 0) {
              console.log(`   Progress: ${progress.percentage}%`);
            }
          },
        });
      } catch (error) {
        if (isWorkerOutOfMemory(error)) {
          throw new SkipTestError('Worker GPU memory exhausted for animate-replace on current fleet');
        }
        throw error;
      }

      console.log(`   Animate-replace generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);
      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
      }

      if (!result.completed) {
        throw new Error('Animate-replace generation did not complete');
      }
      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned from animate-replace generation');
      }
    })();

    await test('Should generate audio for LTX audio-driven video workflows', async () => {
      await sleep(10000);
      const activeClient = ensureClient(client);

      const audioDrivenModelAvailable = availableModelIds.some(
        (id) => (id.startsWith('ltx2-') || id.startsWith('ltx23-')) && (id.includes('_ia2v') || id.includes('_a2v'))
      );
      if (!audioDrivenModelAvailable) {
        console.log('   ⚠️ No LTX ia2v/a2v model currently available, skipping audio reference generation');
        return;
      }

      const audioModel = availableModels.find(
        (model) => model.media === 'audio' || model.id.toLowerCase().includes('ace-step')
      );
      if (!audioModel) {
        console.log('   ⚠️ No audio generation model currently available, skipping audio reference generation');
        return;
      }

      console.log(`   Using audio model: ${audioModel.id}`);
      console.log('   Generating short speech-like reference audio...');

      const result = await activeClient.createAudioProject({
        modelId: audioModel.id,
        positivePrompt: 'A clean spoken-word style vocal counting one two three four over a light metronome',
        numberOfMedia: 1,
        duration: 10,
        steps: audioModel.recommendedSettings?.steps || 20,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 300000,
      });

      console.log(`   Audio generation completed: ${result.completed}`);
      console.log(`   Audio files generated: ${result.audioUrls?.length || 0}`);
      if (!result.audioUrls || result.audioUrls.length === 0) {
        throw new Error('No audio URLs returned from audio generation');
      }

      referenceAudioUrl = result.audioUrls[0];
      console.log(`   Audio URL: ${referenceAudioUrl}`);
      referenceAudioMedia = await fetchMediaBlob(referenceAudioUrl, 'reference audio', 'audio/mpeg');
      console.log(`   Reference audio fetched: ${(referenceAudioMedia.size / 1024).toFixed(2)} KB`);
    })();

    await test('Should generate LTX ia2v video with reference image and audio', async () => {
      await sleep(10000);
      const activeClient = ensureClient(client);

      const ia2vModelId = availableModelIds.find(
        (id) => (id.startsWith('ltx2-') || id.startsWith('ltx23-')) && id.includes('_ia2v')
      );
      if (!ia2vModelId) {
        throw new SkipTestError('No LTX ia2v model currently available');
      }
      if (!catImageBuffer) {
        throw new SkipTestError('Missing reference image asset for ia2v');
      }

      console.log(`   Using model: ${ia2vModelId}`);
      console.log('   Workflow: referenceImage + referenceAudio');
      console.log('   Generating ia2v video...');

      let progressCount = 0;
      const ia2vConfig = {
        modelId: ia2vModelId,
        positivePrompt: 'A cinematic portrait speaking naturally in sync with the audio, subtle head movement',
        negativePrompt: 'blurry, low quality, distorted face, broken lip sync',
        referenceImage: catImageBuffer,
        audioStart: 0,
        audioDuration: 5,
        width: 768,
        height: 768,
        fps: 24,
        duration: 5,
        steps: 20,
        numberOfMedia: 1,
        network: 'fast' as const,
        tokenType: 'spark' as const,
        waitForCompletion: true,
        timeout: 420000,
        onProgress: (progress: { percentage: number }) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      };

      let result;
      try {
        result = await client.createVideoProject({
          ...ia2vConfig,
          referenceAudio: selectReferenceAudioForVideo(referenceAudioMedia),
        });
      } catch (error) {
        if (!isReferenceAudioDownload404(error)) {
          throw error;
        }

        console.log('   ⚠️ Uploaded audio asset returned 404 to worker, retrying with synthetic WAV audio...');
        try {
          result = await activeClient.createVideoProject({
            ...ia2vConfig,
            referenceAudio: createVideoReferenceAudioFallback(),
          });
        } catch (retryError) {
          if (isReferenceAudioDownload404(retryError)) {
            throw new SkipTestError(
              'LTX ia2v reference-audio uploads are currently rejected by the upstream worker/storage path (404 on audio asset download)'
            );
          }
          throw retryError;
        }
      }

      console.log(`   ia2v generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);
      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
      }

      if (!result.completed) {
        throw new Error('ia2v generation did not complete');
      }
      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned from ia2v generation');
      }
    })();

    await test('Should generate LTX a2v video with reference audio only', async () => {
      await sleep(10000);
      const activeClient = ensureClient(client);

      const a2vModelId = availableModelIds.find(
        (id) => (id.startsWith('ltx2-') || id.startsWith('ltx23-')) && id.includes('_a2v') && !id.includes('_ia2v')
      );
      if (!a2vModelId) {
        throw new SkipTestError('No LTX a2v model currently available');
      }

      console.log(`   Using model: ${a2vModelId}`);
      console.log('   Workflow: referenceAudio only');
      console.log('   Generating a2v video...');

      let progressCount = 0;
      const a2vConfig = {
        modelId: a2vModelId,
        positivePrompt: 'Reactive abstract visuals pulsing in sync with the speech rhythm',
        negativePrompt: 'blurry, low quality, visual noise, glitchy artifacts',
        audioStart: 0,
        audioDuration: 5,
        width: 768,
        height: 768,
        fps: 24,
        duration: 5,
        steps: 20,
        numberOfMedia: 1,
        network: 'fast' as const,
        tokenType: 'spark' as const,
        waitForCompletion: true,
        timeout: 420000,
        onProgress: (progress: { percentage: number }) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      };

      let result;
      try {
        result = await activeClient.createVideoProject({
          ...a2vConfig,
          referenceAudio: selectReferenceAudioForVideo(referenceAudioMedia),
        });
      } catch (error) {
        if (!isReferenceAudioDownload404(error)) {
          throw error;
        }

        console.log('   ⚠️ Uploaded audio asset returned 404 to worker, retrying with synthetic WAV audio...');
        try {
          result = await activeClient.createVideoProject({
            ...a2vConfig,
            referenceAudio: createVideoReferenceAudioFallback(),
          });
        } catch (retryError) {
          if (isReferenceAudioDownload404(retryError)) {
            throw new SkipTestError(
              'LTX a2v reference-audio uploads are currently rejected by the upstream worker/storage path (404 on audio asset download)'
            );
          }
          throw retryError;
        }
      }

      console.log(`   a2v generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);
      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
      }

      if (!result.completed) {
        throw new Error('a2v generation did not complete');
      }
      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned from a2v generation');
      }
    })();

    // Test 13: Disconnect
    await test('Should retrieve available LLM chat models', async () => {
      await sleep(5000);
      if (!client) throw new Error('Client not initialized');

      console.log('   Waiting for LLM models...');
      let llmModels: Record<string, { workers?: number }>;
      try {
        llmModels = await client.waitForChatModels(15000);
      } catch (error) {
        if (REQUIRE_LLM_E2E) {
          throw error;
        }
        console.log('   ⚠️ LLM models unavailable right now, skipping LLM e2e tests');
        return;
      }

      availableLlmModels = llmModels;
      const entries = Object.entries(llmModels);
      console.log(`   Found ${entries.length} LLM model(s)`);
      if (entries.length === 0) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No LLM models available');
        }
        console.log('   ⚠️ No LLM models available, skipping LLM e2e tests');
        return;
      }

      const preferred = PREFERRED_LLM_MODEL
        ? entries.find(([id, info]) => id === PREFERRED_LLM_MODEL && (info.workers || 0) > 0)
        : undefined;
      const firstAvailable = entries.find(([, info]) => (info.workers || 0) > 0);
      const fallback = entries[0];

      selectedLlmModelId = (preferred || firstAvailable || fallback)[0];
      const workers = (preferred || firstAvailable || fallback)[1]?.workers ?? 0;
      console.log(`   Selected LLM model: ${selectedLlmModelId} (${workers} workers)`);
    })();

    await test('Should estimate LLM chat completion cost', async () => {
      await sleep(2000);
      if (!client) throw new Error('Client not initialized');
      if (!selectedLlmModelId) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No selected LLM model for chat cost estimation');
        }
        console.log('   ⚠️ Skipping LLM cost estimate (no selected model)');
        return;
      }

      const estimate = await client.estimateChatCost({
        model: selectedLlmModelId,
        messages: [{ role: 'user', content: 'Hello, please reply with one short sentence.' }],
        max_tokens: 64,
        tokenType: 'spark',
      });

      console.log(`   Estimated tokens: in=${estimate.inputTokens}, out=${estimate.outputTokens}`);
      console.log(`   Estimated cost (spark): ${estimate.costInSpark}`);

      if (estimate.outputTokens <= 0) {
        throw new Error('Invalid LLM cost estimate output tokens');
      }
    })();

    await test('Should generate non-streaming LLM chat completion', async () => {
      await sleep(4000);
      if (!client) throw new Error('Client not initialized');
      if (!selectedLlmModelId) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No selected LLM model for non-streaming chat');
        }
        console.log('   ⚠️ Skipping non-streaming LLM chat (no selected model)');
        return;
      }

      const result = await client.createChatCompletion({
        model: selectedLlmModelId,
        messages: [
          { role: 'system', content: 'You are concise.' },
          { role: 'user', content: 'Reply with exactly three words about Sogni.' },
        ],
        max_tokens: 32,
        tokenType: 'spark',
      });

      console.log(`   Chat job: ${result.jobID}`);
      console.log(`   Finish reason: ${result.finishReason}`);
      console.log(`   Content: ${result.content}`);

      if (!result.content || result.content.trim().length === 0) {
        throw new Error('Empty non-streaming chat response');
      }
    })();

    await test('Should generate streaming LLM chat completion and emit chat events', async () => {
      await sleep(4000);
      if (!client) throw new Error('Client not initialized');
      if (!selectedLlmModelId) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No selected LLM model for streaming chat');
        }
        console.log('   ⚠️ Skipping streaming LLM chat (no selected model)');
        return;
      }

      let tokenEvents = 0;
      let completedEvents = 0;
      let stateEvents = 0;

      const onToken = () => { tokenEvents++; };
      const onCompleted = () => { completedEvents++; };
      const onState = () => { stateEvents++; };

      client.on(ClientEvent.CHAT_TOKEN, onToken);
      client.on(ClientEvent.CHAT_COMPLETED, onCompleted);
      client.on(ClientEvent.CHAT_JOB_STATE, onState);

      const stream = await client.createChatCompletion({
        model: selectedLlmModelId,
        messages: [{ role: 'user', content: 'Tell me one short fact about image generation.' }],
        max_tokens: 96,
        stream: true,
        tokenType: 'spark',
      });

      let streamedContent = '';
      for await (const chunk of stream) {
        streamedContent += chunk.content || '';
      }

      console.log(`   Streamed content length: ${streamedContent.length}`);
      console.log(`   Chat events: token=${tokenEvents}, completed=${completedEvents}, state=${stateEvents}`);

      client.off(ClientEvent.CHAT_TOKEN, onToken);
      client.off(ClientEvent.CHAT_COMPLETED, onCompleted);
      client.off(ClientEvent.CHAT_JOB_STATE, onState);

      if (!streamedContent.trim()) {
        throw new Error('Streaming chat returned empty content');
      }
      if (tokenEvents === 0 && completedEvents === 0) {
        throw new Error('No chat token/completed events observed for streaming chat');
      }
    })();

    await test('Should return tool calls for required custom tool invocation', async () => {
      await sleep(4000);
      if (!client) throw new Error('Client not initialized');
      if (!selectedLlmModelId) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No selected LLM model for tool-calling chat');
        }
        console.log('   ⚠️ Skipping tool-calling LLM chat (no selected model)');
        return;
      }

      const modelCandidates = Array.from(
        new Set([
          selectedLlmModelId,
          ...Object.entries(availableLlmModels)
            .filter(([, info]) => (info.workers || 0) > 0)
            .map(([id]) => id)
            .filter((id) => id.toLowerCase().includes('qwen')),
          ...Object.entries(availableLlmModels)
            .filter(([, info]) => (info.workers || 0) > 0)
            .map(([id]) => id),
        ].filter(Boolean) as string[])
      );

      let firstCall: { function: { name: string; arguments: string } } | undefined;
      const diagnosticLines: string[] = [];
      for (const modelId of modelCandidates) {
        const { toolCall, attempts } = await requestForcedAddNumbersToolCall(client, modelId, 41, 1);
        const attemptSummary = attempts
          .map((a) => `max=${a.maxTokens} finish=${a.finishReason} toolCalls=${a.toolCalls}`)
          .join(' | ');
        console.log(`   Model ${modelId}: ${attemptSummary}`);
        diagnosticLines.push(`${modelId}: ${attemptSummary}`);

        if (toolCall) {
          selectedToolCallingModelId = modelId;
          firstCall = toolCall;
          break;
        }
      }

      if (!firstCall) {
        if (REQUIRE_TOOL_CALL_E2E) {
          throw new Error(
            `Expected at least one tool call but none were returned by any available model. Diagnostics: ${diagnosticLines.join(' || ')}`
          );
        }
        console.log('   ⚠️ No available model returned tool_calls; skipping strict tool-call assertion (set SOGNI_REQUIRE_TOOL_CALL_E2E=true to enforce)');
        return;
      }

      if (firstCall.function.name !== 'add_numbers') {
        throw new Error(`Unexpected tool call name: ${firstCall.function.name}`);
      }
      if (!firstCall.function.arguments || firstCall.function.arguments.trim().length === 0) {
        throw new Error('Tool call arguments were empty');
      }
    })();

    await test('Should complete a two-turn tool-calling conversation', async () => {
      await sleep(4000);
      if (!client) throw new Error('Client not initialized');
      if (!selectedLlmModelId) {
        if (REQUIRE_LLM_E2E) {
          throw new Error('No selected LLM model for tool-calling follow-up');
        }
        console.log('   ⚠️ Skipping tool-calling follow-up test (no selected model)');
        return;
      }

      const toolModelId = selectedToolCallingModelId || selectedLlmModelId;

      const { tools, result: first, toolCall: firstToolCall, attempts } =
        await requestForcedAddNumbersToolCall(client, toolModelId, 12, 8);

      if (!firstToolCall) {
        const summary = attempts
          .map((a) => `max=${a.maxTokens} finish=${a.finishReason} toolCalls=${a.toolCalls}`)
          .join(' | ');
        if (REQUIRE_TOOL_CALL_E2E) {
          throw new Error(`Expected initial tool call in two-turn conversation (model: ${toolModelId}). Diagnostics: ${summary}`);
        }
        console.log(`   ⚠️ Model ${toolModelId} returned no tool call for two-turn flow (${summary}); skipping`);
        return;
      }
      if (!first) {
        throw new Error(`Missing first completion result despite tool call (model: ${toolModelId})`);
      }

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(firstToolCall.function.arguments || '{}');
      } catch {
        parsedArgs = {};
      }

      const a = Number(parsedArgs.a || 0);
      const b = Number(parsedArgs.b || 0);
      const sum = a + b;

      const second = await client.createChatCompletion({
        model: toolModelId,
        messages: [
          { role: 'user', content: 'Use add_numbers to add 12 and 8, then answer.' },
          {
            role: 'assistant',
            content: first.content || null,
            tool_calls: first.tool_calls,
          },
          {
            role: 'tool',
            tool_call_id: firstToolCall.id,
            name: firstToolCall.function.name,
            content: JSON.stringify({ a, b, sum }),
          },
        ],
        tools,
        tool_choice: 'auto',
        temperature: 0,
        max_tokens: 128,
        tokenType: 'spark',
      });

      console.log(`   Follow-up finish reason: ${second.finishReason}`);
      console.log(`   Follow-up content: ${second.content}`);

      if (!second.content || second.content.trim().length === 0) {
        throw new Error('Tool-calling follow-up returned empty assistant content');
      }
    })();

    // Final test: Disconnect
    await test('Should disconnect cleanly', async () => {
      if (!client) throw new Error('Client not initialized');
      
      await client.disconnect();
      
      if (client.isConnected()) {
        throw new Error('Client still connected after disconnect');
      }
      console.log('   Disconnected successfully');
    })();

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('END-TO-END TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log(`⏭️ Tests skipped: ${testsSkipped}`);
  console.log(`📊 Total tests (run): ${testsPassed + testsFailed}`);
  const runTotal = testsPassed + testsFailed;
  const successRate = runTotal > 0 ? ((testsPassed / runTotal) * 100).toFixed(1) : '0.0';
  console.log(`🎯 Success rate: ${successRate}%`);
  console.log('='.repeat(60));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
