/**
 * Enhanced Sogni Client Wrapper
 * Provides a simplified, promise-based interface to the Sogni AI SDK
 */

import { EventEmitter } from 'events';
import { SogniClient, Project, Job, ChatStream } from '@sogni-ai/sogni-client';
import { VIDEO_UPSCALE_MODEL_ID } from '../media/videoUpscale.js';
import type {
  SogniClientConfig,
  SogniAttributionConfig,
  AuthType,
  ProjectConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
  ProjectResult,
  ProjectProgress,
  ConnectionStatus,
  ConnectionState,
  ModelInfo,
  BalanceInfo,
  AccountInfo,
  SubscriptionEntitlementSnapshot,
  SizePreset,
  GetModelsOptions,
  ClientEventCallbacks,
  JobCompletedData,
  JobFailedData,
  QwenImageEditConfig,
  ProjectEvent,
  JobEvent,
  InputMedia,
  VideoCostEstimateParams,
  AudioCostEstimateParams,
  CostEstimate,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionChunk,
  ChatCompletionResult,
  ChatJobStateEvent,
  LLMCostEstimation,
  LLMModelInfo,
  ChatErrorData,
  CreativeWorkflowEvent,
  CreativeWorkflowRecord,
  CreativeWorkflowSseEvent,
  ListCreativeWorkflowOptions,
  StartCreativeWorkflowOptions,
  StartCreativeWorkflowParams,
  StreamCreativeWorkflowEventsOptions,
} from '../types/index.js';
import { ClientEvent } from '../types/index.js';
import {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniModelNotFoundError,
  SogniValidationError,
} from '../utils/errors.js';
import {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  waitFor,
  retry,
  getMaxContextImages,
  getVideoDimensionRules,
  isHappyHorseVideoModel,
  isLtxVideoModel,
  isLooseReferenceVideoModel,
  isSeedance25VideoModel,
  isSeedanceVideoModel,
  isWanVideoModel,
} from '../utils/helpers.js';
import { isRegisteredWan3VideoModelId } from '../utils/videoModelIds.js';

const LTX2_FRAME_STEP = 8;

function freezeAttributionDefaults(
  attribution: SogniAttributionConfig | undefined,
): SogniAttributionConfig | undefined {
  if (!attribution) return undefined;
  const connection = attribution.connection
    ? Object.freeze({ ...attribution.connection })
    : undefined;
  const workload = attribution.workload
    ? Object.freeze({ ...attribution.workload })
    : undefined;
  return Object.freeze({
    ...(connection ? { connection } : {}),
    ...(workload ? { workload } : {}),
  });
}

/**
 * Internal configuration type with resolved defaults
 */
interface InternalConfig {
  username: string;
  password: string;
  apiKey?: string;
  appSource?: string;
  attribution?: SogniAttributionConfig;
  appId: string;
  network: 'fast' | 'relaxed';
  testnet?: boolean;
  socketEndpoint?: string;
  restEndpoint?: string;
  disableSocket?: boolean;
  multiInstance?: boolean;
  allowInsecureTLS?: boolean;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectInterval: number;
  timeout: number;
  debug: boolean;
  authType: AuthType;
}

/**
 * Enhanced Sogni Client with improved developer experience
 */
export class SogniClientWrapper extends EventEmitter {
  private client: SogniClient | null = null;
  private config: InternalConfig;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;
  private projectEventHandler: ((event: ProjectEvent) => void) | null = null;
  private jobEventHandler: ((event: JobEvent) => void) | null = null;
  private chatTokenEventHandler: ((chunk: ChatCompletionChunk) => void) | null = null;
  private chatCompletedEventHandler: ((result: ChatCompletionResult) => void) | null = null;
  private chatErrorEventHandler: ((error: ChatErrorData) => void) | null = null;
  private chatJobStateEventHandler: ((state: ChatJobStateEvent) => void) | null = null;
  private chatModelsUpdatedEventHandler: ((models: Record<string, LLMModelInfo>) => void) | null = null;
  private projectEtaSeconds = new Map<string, number>();

  constructor(config: SogniClientConfig) {
    super();

    // Avoid Node's special-case 'error' event crashing the process when users
    // haven't attached an error listener yet (especially with autoConnect).
    this.on(ClientEvent.ERROR, (_error) => {});

    // Validate configuration
    validateClientConfig(config);

    // Set defaults - username/password default to empty for cookie auth
    this.config = {
      username: config.username || '',
      password: config.password || '',
      apiKey: config.apiKey,
      appSource: config.appSource?.trim() || undefined,
      attribution: freezeAttributionDefaults(config.attribution),
      appId: config.appId || generateAppId(),
      network: config.network || 'fast',
      testnet: config.testnet,
      socketEndpoint: config.socketEndpoint,
      restEndpoint: config.restEndpoint,
      disableSocket: config.disableSocket,
      multiInstance: config.multiInstance,
      allowInsecureTLS: config.allowInsecureTLS,
      autoConnect: config.autoConnect !== false,
      reconnect: config.reconnect !== false,
      reconnectInterval: config.reconnectInterval || 5000,
      timeout: config.timeout || 300000, // 5 minutes default
      debug: config.debug || false,
      authType: config.authType || (config.apiKey ? 'apiKey' : 'token'),
    };

    // Initialize connection state
    this.connectionState = {
      status: 'disconnected' as ConnectionStatus,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
    };

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      this.connect().catch((error) => {
        this.log('Auto-connect failed:', error);
        this.emit(ClientEvent.ERROR, SogniError.fromError(error, 'AUTO_CONNECT_FAILED').toErrorData());
      });
    }
  }

  /**
   * Connect to Sogni Supernet
   */
  async connect(): Promise<void> {
    if (this.connectionState.isConnected) {
      this.log('Already connected');
      return;
    }

    if (this.connectionState.isConnecting) {
      this.log('Connection already in progress');
      await waitFor(() => this.connectionState.isConnected, {
        timeout: 30000,
        timeoutMessage: 'Connection timeout',
      });
      return;
    }

    this.updateConnectionState({ status: 'connecting' as ConnectionStatus, isConnecting: true });

    try {
      this.log('Creating Sogni client...');

      if (this.config.allowInsecureTLS) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        this.log('TLS verification disabled (allowInsecureTLS=true)');
      }

      const clientConfig = {
        appId: this.config.appId,
        network: this.config.network,
        authType: this.config.authType,
        apiKey: this.config.apiKey,
        appSource: this.config.appSource,
        attribution: this.config.attribution,
        testnet: this.config.testnet,
        socketEndpoint: this.config.socketEndpoint,
        restEndpoint: this.config.restEndpoint,
        disableSocket: this.config.disableSocket,
        multiInstance: this.config.multiInstance,
      } as Parameters<typeof SogniClient.createInstance>[0] & {
        appSource?: string;
        attribution?: SogniAttributionConfig;
      };

      // Create client instance with auth type
      this.client = await SogniClient.createInstance(clientConfig);

      // Authentication depends on authType
      if (this.config.authType === 'cookies') {
        this.log('Checking authentication via cookies...');

        // For cookie auth, check if already authenticated
        const isAuthenticated = await this.client.checkAuth();

        if (!isAuthenticated) {
          // If not authenticated via cookies and credentials provided, try login
          if (this.config.username && this.config.password) {
            this.log('Cookie auth failed, attempting login with credentials...');
            await this.client.account.login(this.config.username, this.config.password);
          } else {
            throw new SogniAuthenticationError(
              'Cookie authentication failed and no credentials provided',
              undefined
            );
          }
        }
      } else if (this.config.authType === 'apiKey') {
        this.log('Using API key authentication...');
      } else {
        this.log('Logging in with credentials...');

        // Token auth - login with username/password
        await this.client.account.login(this.config.username, this.config.password);
      }

      this.log('Waiting for models...');

      // Wait for models to be available
      await this.client.projects.waitForModels();

      this.log('Connected successfully');

      this.updateConnectionState({
        status: 'connected' as ConnectionStatus,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        connectedAt: new Date(),
      });

      this.emit(ClientEvent.CONNECTED);

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      this.log('Connection failed:', error);
      
      const sogniError = error instanceof Error && error.message.includes('auth')
        ? new SogniAuthenticationError('Authentication failed', undefined, error as Error)
        : new SogniConnectionError('Failed to connect to Sogni Supernet', undefined, error as Error);

      this.updateConnectionState({
        status: 'failed' as ConnectionStatus,
        isConnected: false,
        isConnecting: false,
        lastError: sogniError.toErrorData(),
      });

      this.emit(ClientEvent.ERROR, sogniError.toErrorData());

      // Attempt reconnection if enabled
      if (this.config.reconnect && !this.isReconnecting) {
        this.scheduleReconnect();
      }

      throw sogniError;
    }
  }

  /**
   * Disconnect from Sogni Supernet
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isReconnecting = false;

    if (this.client) {
      try {
        if (this.projectEventHandler) {
          this.client.projects.off('project', this.projectEventHandler);
        }
        if (this.jobEventHandler) {
          this.client.projects.off('job', this.jobEventHandler);
        }
        if (this.chatTokenEventHandler) {
          this.client.chat.off('token', this.chatTokenEventHandler);
        }
        if (this.chatCompletedEventHandler) {
          this.client.chat.off('completed', this.chatCompletedEventHandler);
        }
        if (this.chatErrorEventHandler) {
          this.client.chat.off('error', this.chatErrorEventHandler);
        }
        if (this.chatJobStateEventHandler) {
          this.client.chat.off('jobState', this.chatJobStateEventHandler);
        }
        if (this.chatModelsUpdatedEventHandler) {
          this.client.chat.off('modelsUpdated', this.chatModelsUpdatedEventHandler);
        }

        if (typeof this.client.dispose === 'function') {
          this.client.dispose();
          this.log('SDK client disposed');
        } else if (this.client.apiClient && this.client.apiClient.socket) {
          // Fallback for older SDKs without dispose()
          this.client.apiClient.socket.disconnect();
          this.log('WebSocket disconnected');
        }
      } catch (error) {
        this.log('Error disconnecting WebSocket:', error);
      }
      this.client = null;
    }
    this.projectEtaSeconds.clear();

    this.updateConnectionState({
      status: 'disconnected' as ConnectionStatus,
      isConnected: false,
      isConnecting: false,
    });

    this.emit(ClientEvent.DISCONNECTED);
    this.log('Disconnected');
  }

  /**
   * Dispose this wrapper instance and release all listeners/resources.
   * The wrapper should not be reused after calling this method.
   */
  async dispose(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected && this.client !== null;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get available models
   */
  async getAvailableModels(options: GetModelsOptions = {}): Promise<ModelInfo[]> {
    await this.ensureConnected();

    let models = this.client!.projects.availableModels;

    // Filter by network if specified
    if (options.network) {
      // Note: Sogni SDK doesn't expose network per model, so we return all
      // This is a limitation of the underlying SDK
    }

    // Filter by minimum workers
    if (options.minWorkers !== undefined) {
      models = models.filter((m) => m.workerCount >= options.minWorkers!);
    }

    // Sort by worker count
    if (options.sortByWorkers) {
      models = [...models].sort((a, b) => b.workerCount - a.workerCount);
    }

    // Convert to ModelInfo format
    return models.map((model) => ({
      ...model,
      isAvailable: model.workerCount > 0,
      recommendedSettings: this.getRecommendedSettings(model.id),
    }));
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<ModelInfo> {
    const models = await this.getAvailableModels();
    const model = models.find((m) => m.id === modelId);

    if (!model) {
      throw new SogniModelNotFoundError(modelId);
    }

    return model;
  }

  /**
   * Get the most popular model (highest worker count)
   */
  async getMostPopularModel(): Promise<ModelInfo> {
    const models = await this.getAvailableModels({ sortByWorkers: true });
    
    if (models.length === 0) {
      throw new SogniError('No models available', 'NO_MODELS_AVAILABLE');
    }

    return models[0];
  }

  /**
   * Get available chat/LLM models
   */
  async getAvailableChatModels(): Promise<Record<string, LLMModelInfo>> {
    await this.ensureConnected();
    return this.client!.chat.models;
  }

  /**
   * Wait for chat/LLM models from the network
   */
  async waitForChatModels(timeout: number = 10000): Promise<Record<string, LLMModelInfo>> {
    await this.ensureConnected();
    return this.client!.chat.waitForModels(timeout);
  }

  /**
   * Estimate chat completion cost
   */
  async estimateChatCost(params: {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    tokenType?: 'sogni' | 'spark';
  }): Promise<LLMCostEstimation> {
    await this.ensureConnected();
    return this.client!.chat.estimateCost(params);
  }

  /**
   * Create a chat completion request
   */
  async createChatCompletion(
    params: ChatCompletionParams & { stream: true }
  ): Promise<ChatStream>;
  async createChatCompletion(
    params: ChatCompletionParams & { stream?: false }
  ): Promise<ChatCompletionResult>;
  async createChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatStream | ChatCompletionResult> {
    await this.ensureConnected();
    return this.client!.chat.completions.create(params as any) as Promise<ChatStream | ChatCompletionResult>;
  }

  /**
   * Start a creative workflow via the SDK creative workflows API
   */
  async startCreativeWorkflow(
    params: StartCreativeWorkflowParams,
    options?: StartCreativeWorkflowOptions
  ): Promise<CreativeWorkflowRecord> {
    await this.ensureConnected();
    return this.client!.workflows.start(params, options);
  }

  /**
   * List creative workflows
   */
  async listCreativeWorkflows(
    options?: ListCreativeWorkflowOptions
  ): Promise<CreativeWorkflowRecord[]> {
    await this.ensureConnected();
    return this.client!.workflows.list(options);
  }

  /**
   * Get a creative workflow by ID
   */
  async getCreativeWorkflow(workflowId: string): Promise<CreativeWorkflowRecord> {
    await this.ensureConnected();
    return this.client!.workflows.get(workflowId);
  }

  /**
   * Get historic events for a creative workflow
   */
  async getCreativeWorkflowEvents(workflowId: string): Promise<CreativeWorkflowEvent[]> {
    await this.ensureConnected();
    return this.client!.workflows.events(workflowId);
  }

  /**
   * Cancel a creative workflow
   */
  async cancelCreativeWorkflow(workflowId: string): Promise<CreativeWorkflowRecord> {
    await this.ensureConnected();
    return this.client!.workflows.cancel(workflowId);
  }

  /**
   * Stream creative workflow SSE events
   */
  async streamCreativeWorkflowEvents(
    workflowId: string,
    options?: StreamCreativeWorkflowEventsOptions
  ): Promise<AsyncIterableIterator<CreativeWorkflowSseEvent>> {
    await this.ensureConnected();
    return this.client!.workflows.streamEvents(workflowId, options);
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BalanceInfo> {
    await this.ensureConnected();

    // Use the correct refreshBalance() method from the account API
    const balances = await this.client!.account.refreshBalance();

    // The refreshBalance() method returns a Balances object with sogni and spark properties
    // Each contains multiple balance fields - we'll use the 'net' balance which represents
    // the actual available balance (settled + credit - debit)
    return {
      sogni: parseFloat(balances.sogni.net) || 0,
      spark: parseFloat(balances.spark.net) || 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Fetch the authenticated account's subscription entitlement snapshot from
   * the server (Sogni Unlimited / Unlimited Pro). When no subscription exists,
   * the snapshot has `active: false` and `status: 'none'`.
   *
   * Also refreshes the cached `subscription` returned by getAccountInfo().
   */
  async getSubscriptionStatus(): Promise<SubscriptionEntitlementSnapshot> {
    await this.ensureConnected();

    try {
      return await this.client!.account.getSubscriptionStatus();
    } catch (error) {
      throw SogniError.fromError(error, 'GET_SUBSCRIPTION_STATUS_FAILED');
    }
  }

  /**
   * Identity and entitlement snapshot for the authenticated account
   * (username, wallet, network, cached subscription). Reads locally cached
   * account state — call getSubscriptionStatus() first when a
   * server-authoritative entitlement answer is required.
   */
  async getAccountInfo(): Promise<AccountInfo> {
    await this.ensureConnected();

    const account = this.client!.account.currentAccount;
    return {
      username: account?.username,
      email: account?.email,
      walletAddress: account?.walletAddress,
      network: account?.network ?? null,
      isUnlimited: account?.isUnlimited ?? false,
      subscription: account?.subscription,
    };
  }

  /**
   * Get size presets for a model
   */
  async getSizePresets(network: 'fast' | 'relaxed', modelId: string): Promise<SizePreset[]> {
    await this.ensureConnected();

    try {
      const presets = await this.client!.projects.getSizePresets(network, modelId);
      return presets as SizePreset[];
    } catch (error) {
      throw SogniError.fromError(error, 'GET_SIZE_PRESETS_FAILED');
    }
  }

  /**
   * Estimate video project cost
   */
  async estimateVideoCost(params: VideoCostEstimateParams): Promise<CostEstimate> {
    await this.ensureConnected();

    if (!params.modelId || typeof params.modelId !== 'string') {
      throw new SogniValidationError('Model ID is required and must be a string');
    }
    if (typeof params.width !== 'number' || typeof params.height !== 'number') {
      throw new SogniValidationError('Width and height are required and must be numbers');
    }
    if (params.fps !== undefined && (typeof params.fps !== 'number' || params.fps <= 0)) {
      throw new SogniValidationError('FPS must be a positive number');
    }
    if (params.steps !== undefined && (typeof params.steps !== 'number' || params.steps <= 0)) {
      throw new SogniValidationError('Steps must be a positive number');
    }
    if (
      params.referenceImageCount !== undefined &&
      (!Number.isInteger(params.referenceImageCount) || params.referenceImageCount < 0)
    ) {
      throw new SogniValidationError('Reference image count must be a non-negative integer');
    }

    const tokenType = params.tokenType || 'spark';
    const numberOfMedia = params.numberOfMedia || 1;
    const fps = this.getVideoFps(params.modelId, params.fps);

    let duration = params.duration;
    if (duration === undefined || duration === null) {
      if (params.frames !== undefined && params.frames > 0) {
        const durationFps = this.getVideoGenerationFps(params.modelId, fps);
        duration = Math.max(1, Math.round((params.frames - 1) / durationFps));
      } else {
        duration = this.getVideoDurationBounds(params.modelId).min;
      }
    }

    const { min: minDuration, max: maxDuration } = this.getVideoDurationBounds(params.modelId);
    if (duration < minDuration || duration > maxDuration) {
      throw new SogniValidationError(
        `Duration must be between ${minDuration} and ${maxDuration} seconds`
      );
    }

    const frames =
      params.frames !== undefined
        ? params.frames
        : this.calculateVideoFrames(params.modelId, duration, fps);

    return this.client!.projects.estimateVideoCost({
      tokenType,
      model: params.modelId,
      width: params.width,
      height: params.height,
      duration,
      frames,
      fps,
      steps: params.steps,
      numberOfMedia,
      ...(params.referenceImageCount !== undefined
        ? { referenceImageCount: params.referenceImageCount }
        : {}),
    });
  }

  /**
   * Estimate audio project cost
   */
  async estimateAudioCost(params: AudioCostEstimateParams): Promise<CostEstimate> {
    await this.ensureConnected();

    if (!params.modelId || typeof params.modelId !== 'string') {
      throw new SogniValidationError('Model ID is required and must be a string');
    }
    if (typeof params.duration !== 'number' || params.duration < 10 || params.duration > 600) {
      throw new SogniValidationError('Duration is required and must be between 10 and 600 seconds');
    }
    if (typeof params.steps !== 'number' || params.steps <= 0) {
      throw new SogniValidationError('Steps is required and must be a positive number');
    }

    const tokenType = params.tokenType || 'spark';
    const numberOfMedia = params.numberOfMedia || 1;

    return this.client!.projects.estimateAudioCost({
      tokenType,
      model: params.modelId,
      duration: params.duration,
      steps: params.steps,
      numberOfMedia,
    });
  }

  /**
   * Create a project and optionally wait for completion
   */
  async createProject(config: ProjectConfig): Promise<ProjectResult> {
    await this.ensureConnected();

    // Prepare config (video asset normalization, etc.)
    const preparedConfig = await this.prepareProjectConfig(config);

    // Validate project configuration
    validateProjectConfig(preparedConfig);

    const {
      waitForCompletion = true,
      timeout = this.config.timeout,
      onProgress,
      onJobCompleted,
      onJobFailed,
      autoResizeVideoAssets: _autoResizeVideoAssets,
      ...projectParams
    } = preparedConfig;

    try {
      this.log('Creating project with config:', this.sanitizeConfig(preparedConfig));

      // Prepare project params with defaults for required SDK fields
      const sdkParams = {
        ...projectParams,
        tokenType: projectParams.tokenType || 'spark',
        network: projectParams.network || 'fast',
      };

      // Create the project
      const project = await this.client!.projects.create(sdkParams);

      this.emit(ClientEvent.PROJECT_CREATED, project);

      // Set up event listeners for this project
      const totalJobs = projectParams.numberOfMedia || 1;
      let completedJobCount = 0;
      let failedJobCount = 0;

      project.on('progress', (progress: number) => {
        let safeProgress = Number.isFinite(progress) ? progress : 0;
        if (!Number.isFinite(progress)) {
          this.log('Received non-finite progress value, coercing to 0:', progress);
        }
        if (safeProgress < 0) safeProgress = 0;
        if (safeProgress > 100) safeProgress = 100;

        const progressData: ProjectProgress = {
          projectId: project.id,
          percentage: safeProgress,
          completedJobs: completedJobCount,
          totalJobs,
        };
        const etaSeconds = this.projectEtaSeconds.get(project.id);
        if (etaSeconds !== undefined) {
          progressData.estimatedTimeRemaining = etaSeconds * 1000;
        }

        if (onProgress) {
          onProgress(progressData);
        }

        this.emit(ClientEvent.PROJECT_PROGRESS, progressData);
      });

      // Always set up job event listeners to emit wrapper events
      project.on('jobCompleted', (job: Job) => {
        completedJobCount++;

        const jobData: JobCompletedData = {
          projectId: project.id,
          job,
          jobIndex: completedJobCount - 1,
          totalJobs,
        };

        // Add appropriate URL based on project type
        if (isImageProjectConfig(preparedConfig)) {
          jobData.imageUrl = job.resultUrl || undefined;
        } else if (isVideoProjectConfig(preparedConfig)) {
          jobData.videoUrl = job.resultUrl || undefined;
        } else if (isAudioProjectConfig(preparedConfig)) {
          jobData.audioUrl = job.resultUrl || undefined;
        }

        // Emit wrapper event
        this.emit(ClientEvent.JOB_COMPLETED, jobData);

        // Call user callback if provided
        if (onJobCompleted) {
          onJobCompleted(job);
        }
      });

      project.on('jobFailed', (job: Job) => {
        failedJobCount++;

        const jobData: JobFailedData = {
          projectId: project.id,
          job,
          error: job.error?.message || 'Job failed',
          jobIndex: failedJobCount - 1,
          totalJobs,
        };

        // Emit wrapper event
        this.emit(ClientEvent.JOB_FAILED, jobData);

        // Call user callback if provided
        if (onJobFailed) {
          onJobFailed(job);
        }
      });

      // If not waiting for completion, return immediately
      if (!waitForCompletion) {
        return {
          project,
          completed: false,
        };
      }

      // Wait for completion with timeout
      this.log('Waiting for project completion...');

      const mediaUrls = await this.withTimeout(project.waitForCompletion(), timeout);

      this.log('Project completed successfully');

      // Prepare result based on project type
      const result: ProjectResult = {
        project,
        completed: true,
      };

      // Add appropriate URLs based on project type
      if (isImageProjectConfig(preparedConfig)) {
        result.imageUrls = mediaUrls;
      } else if (isVideoProjectConfig(preparedConfig)) {
        result.videoUrls = mediaUrls;
      } else if (isAudioProjectConfig(preparedConfig)) {
        result.audioUrls = mediaUrls;
      }

      this.emit(ClientEvent.PROJECT_COMPLETED, result);

      return result;

    } catch (error) {
      this.log('Project failed:', error);
      
      let projectError: SogniError;
      if (error instanceof SogniTimeoutError || error instanceof SogniProjectError) {
        projectError = error;
      } else if (error instanceof SogniError) {
        projectError = new SogniProjectError(
          error.message || 'Project creation failed',
          {
            originalCode: error.code,
            originalStatusCode: error.statusCode,
            originalDetails: error.details,
          },
          error,
        );
      } else if (error instanceof Error) {
        projectError = new SogniProjectError(
          error.message || 'Project creation failed',
          undefined,
          error,
        );
      } else {
        projectError = new SogniProjectError(
          String(error || 'Project creation failed'),
        );
      }

      this.emit(ClientEvent.PROJECT_FAILED, projectError.toErrorData());

      throw projectError;
    }
  }

  /**
   * Create a project with retry logic
   */
  async createProjectWithRetry(
    config: ProjectConfig,
    options: { maxAttempts?: number; retryDelay?: number } = {}
  ): Promise<ProjectResult> {
    const { maxAttempts = 3, retryDelay = 2000 } = options;

    return retry(
      () => this.createProject(config),
      {
        maxAttempts,
        initialDelay: retryDelay,
        onRetry: (attempt, error) => {
          this.log(`Retry attempt ${attempt} after error:`, error.message);
        },
      }
    );
  }

  /**
   * Convenience method to create an image project
   */
  async createImageProject(config: Omit<ImageProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'image',
    } as ImageProjectConfig);
  }

  /**
   * Convenience method to create a video project
   */
  async createVideoProject(config: Omit<VideoProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'video',
    } as VideoProjectConfig);
  }

  /**
   * Convenience method to create an audio project
   */
  async createAudioProject(config: Omit<AudioProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'audio',
    } as AudioProjectConfig);
  }

  /**
   * Convenience method to create an image edit project (e.g., Qwen Image Edit)
   *
   * @example
   * ```typescript
   * const result = await client.createImageEditProject({
   *   modelId: 'qwen_image_edit_2511_fp8',
   *   positivePrompt: 'Transform the cat into a lion',
   *   contextImages: [imageBuffer],
   *   numberOfMedia: 1,
   * });
   * ```
   */
  async createImageEditProject(config: QwenImageEditConfig): Promise<ProjectResult> {
    // Model-specific context image limit validation
    const maxImages = getMaxContextImages(config.modelId);
    if (config.contextImages && config.contextImages.length > maxImages) {
      throw new SogniValidationError(
        `Model ${config.modelId} supports a maximum of ${maxImages} context images, got ${config.contextImages.length}`
      );
    }

    return this.createProject({
      ...config,
      type: 'image',
    } as ImageProjectConfig);
  }

  /**
   * Prepare project config (e.g., normalize video assets)
   */
  private async prepareProjectConfig(config: ProjectConfig): Promise<ProjectConfig> {
    if (!isVideoProjectConfig(config)) {
      return config;
    }

    if (config.autoResizeVideoAssets === false) {
      return config;
    }

    // FlashVSR upscales the uploaded source exactly as it is; the server derives
    // the output size from that verified source. Never resize its reference or
    // normalize its dimensions to another model family's envelope.
    if (config.modelId === VIDEO_UPSCALE_MODEL_ID) {
      return config;
    }

    const normalized: VideoProjectConfig = { ...config };

    // I2V/FLF inputs are canvas anchors and must stay dimensionally aligned with
    // the output. R2V inputs are loose conditioning references: their aspect
    // ratio must never replace the requested video canvas. URL-based loose
    // references are already ignored by this binary-media path; the explicit
    // model guard covers H3 and direct HappyHorse r2v callers that use a Buffer.
    const referenceImagesDefineCanvas = config.seedanceTaskType !== 'reference'
      && !isLooseReferenceVideoModel(config.modelId);
    const hasReferenceImage = referenceImagesDefineCanvas
      && this.isProcessableMedia(config.referenceImage);
    const hasReferenceImageEnd = referenceImagesDefineCanvas
      && this.isProcessableMedia(config.referenceImageEnd);

    let baseKey: 'referenceImage' | 'referenceImageEnd' | null = null;
    if (hasReferenceImage) {
      baseKey = 'referenceImage';
    } else if (hasReferenceImageEnd) {
      baseKey = 'referenceImageEnd';
    }

    let baseBuffer: Buffer | null = null;
    if (baseKey) {
      baseBuffer = await this.mediaToBuffer(config[baseKey] as InputMedia);
    }

    let width = config.width;
    let height = config.height;

    if ((!width || !height) && baseBuffer) {
      const meta = await this.getImageMetadata(baseBuffer);
      if (meta) {
        width = width || meta.width;
        height = height || meta.height;
      }
    }

    if (width && height) {
      const originalWidth = width;
      const originalHeight = height;
      const normalizedDims = this.normalizeVideoDimensions(width, height, config.modelId);
      if (normalizedDims.adjusted) {
        console.log(
          `[SogniClientWrapper] Adjusted video dimensions from ${originalWidth}x${originalHeight} to ${normalizedDims.width}x${normalizedDims.height} to meet ${config.modelId} video requirements.`
        );
      }
      width = normalizedDims.width;
      height = normalizedDims.height;
    }

    if (baseBuffer && width && height) {
      const baseFit: 'inside' | 'cover' =
        baseKey === 'referenceImageEnd' && !!config.referenceImage ? 'cover' : 'inside';
      const fittedBase = await this.resizeImageBuffer(baseBuffer, width, height, baseFit);
      // `fit: inside` preserves the source aspect ratio, so Sharp may emit an
      // actual size that no longer follows the model's grid. For example,
      // fitting 1472x1024 inside H3's 1344x768 box yields 1104x768; 1104 is not
      // divisible by H3's required 32px step. Re-normalize the *actual* fitted
      // size and, only when needed, make a tiny center crop from the original
      // so the final reference and project dimensions are guaranteed valid.
      const fittedDims = this.normalizeVideoDimensions(fittedBase.width, fittedBase.height, config.modelId);
      const resizedBase = fittedDims.adjusted
        ? await this.resizeImageBuffer(baseBuffer, fittedDims.width, fittedDims.height, 'cover')
        : fittedBase;
      if (resizedBase.wasResized) {
        console.log(
          `[SogniClientWrapper] Resized ${baseKey} from ${resizedBase.originalWidth}x${resizedBase.originalHeight} to ${resizedBase.width}x${resizedBase.height} to meet video requirements.`
        );
      }
      width = resizedBase.width;
      height = resizedBase.height;
      if (baseKey === 'referenceImage') {
        normalized.referenceImage = resizedBase.buffer;
      } else if (baseKey === 'referenceImageEnd') {
        normalized.referenceImageEnd = resizedBase.buffer;
      }
    }

    if (width && height) {
      normalized.width = width;
      normalized.height = height;
    }

    // If both start and end images are provided, ensure end matches start dimensions
    if (config.referenceImage && config.referenceImageEnd && hasReferenceImageEnd && width && height && baseKey === 'referenceImage') {
      const endBuffer = await this.mediaToBuffer(config.referenceImageEnd as InputMedia);
      if (endBuffer) {
        const resizedEnd = await this.resizeImageBuffer(endBuffer, width, height, 'cover');
        if (resizedEnd.wasResized || resizedEnd.width !== width || resizedEnd.height !== height) {
          console.log(
            `[SogniClientWrapper] Resized referenceImageEnd from ${resizedEnd.originalWidth}x${resizedEnd.originalHeight} to ${resizedEnd.width}x${resizedEnd.height} to match referenceImage.`
          );
        }
        normalized.referenceImageEnd = resizedEnd.buffer;
      }
    }

    return normalized;
  }

  private normalizeVideoDimensions(width: number, height: number, modelId?: string): {
    width: number;
    height: number;
    adjusted: boolean;
  } {
    // Model-family envelope (LTX-2.x runs 640–3840; the old blanket 1536 cap
    // silently downscaled every LTX-2.5 1080p request). Unknown models keep
    // the legacy 480–1536 envelope.
    const rules = getVideoDimensionRules(modelId);
    const minDimension = rules.minDimension;
    const maxDimension = rules.maxDimension;
    const dimensionMultiple = rules.dimensionMultiple;
    const maxPixels = rules.maxPixels;

    let targetWidth = width;
    let targetHeight = height;
    let adjusted = false;

    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const scaleFactor = Math.min(
        maxDimension / targetWidth,
        maxDimension / targetHeight
      );
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
      adjusted = true;
    }

    if (targetWidth < minDimension || targetHeight < minDimension) {
      const scaleFactor = Math.max(
        minDimension / targetWidth,
        minDimension / targetHeight
      );
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
      adjusted = true;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        const downscaleFactor = Math.min(
          maxDimension / targetWidth,
          maxDimension / targetHeight
        );
        targetWidth = Math.floor(targetWidth * downscaleFactor);
        targetHeight = Math.floor(targetHeight * downscaleFactor);
      }
    }

    if (maxPixels && targetWidth * targetHeight > maxPixels) {
      const scaleFactor = Math.sqrt(maxPixels / (targetWidth * targetHeight));
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
      adjusted = true;
    }

    if (dimensionMultiple > 1) {
      const roundedWidth = Math.floor(targetWidth / dimensionMultiple) * dimensionMultiple;
      const roundedHeight = Math.floor(targetHeight / dimensionMultiple) * dimensionMultiple;

      if (roundedWidth !== targetWidth || roundedHeight !== targetHeight) {
        adjusted = true;
      }

      targetWidth = roundedWidth;
      targetHeight = roundedHeight;
    }

    if (targetWidth < minDimension) {
      targetWidth = Math.ceil(minDimension / dimensionMultiple) * dimensionMultiple;
      adjusted = true;
    }
    if (targetHeight < minDimension) {
      targetHeight = Math.ceil(minDimension / dimensionMultiple) * dimensionMultiple;
      adjusted = true;
    }

    return { width: targetWidth, height: targetHeight, adjusted };
  }

  private isProcessableMedia(media: InputMedia | undefined): media is Buffer | Blob {
    if (!media) return false;
    if (Buffer.isBuffer(media)) return true;
    return typeof Blob !== 'undefined' && media instanceof Blob;
  }

  private async mediaToBuffer(media: InputMedia): Promise<Buffer | null> {
    if (Buffer.isBuffer(media)) {
      return media;
    }
    if (typeof Blob !== 'undefined' && media instanceof Blob) {
      const arrayBuffer = await media.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return null;
  }

  private async getImageMetadata(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    const sharp = await this.loadSharp();
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      return null;
    }
    return { width: meta.width, height: meta.height };
  }

  private async resizeImageBuffer(
    buffer: Buffer,
    width: number,
    height: number,
    fit: 'inside' | 'cover'
  ): Promise<{ buffer: Buffer; width: number; height: number; wasResized: boolean; originalWidth: number; originalHeight: number }> {
    const sharp = await this.loadSharp();
    const meta = await sharp(buffer).metadata();
    const originalWidth = meta.width || width;
    const originalHeight = meta.height || height;

    if (meta.width === width && meta.height === height) {
      return { buffer, width: originalWidth, height: originalHeight, wasResized: false, originalWidth, originalHeight };
    }

    const resizedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit,
        position: 'center',
        withoutEnlargement: false,
      })
      .toBuffer();

    const resizedMeta = await sharp(resizedBuffer).metadata();
    return {
      buffer: resizedBuffer,
      width: resizedMeta.width || width,
      height: resizedMeta.height || height,
      wasResized: true,
      originalWidth,
      originalHeight,
    };
  }

  private async loadSharp(): Promise<import('sharp').SharpConstructor> {
    const sharpModule = await import('sharp');
    return ((sharpModule as unknown as { default?: unknown }).default || sharpModule) as import('sharp').SharpConstructor;
  }

  /**
   * Ensure client is connected, connect if not
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }
  }

  /**
   * Set up event listeners on the underlying client
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    if (!this.projectEventHandler) {
      this.projectEventHandler = (event: ProjectEvent) => {
        if (event.type === 'completed' || event.type === 'error') {
          this.projectEtaSeconds.delete(event.projectId);
        }
        this.emit(ClientEvent.PROJECT_EVENT, event);
      };
    }

    if (!this.jobEventHandler) {
      this.jobEventHandler = (event: JobEvent) => {
        if (event.type === 'jobETA') {
          this.projectEtaSeconds.set(event.projectId, event.etaSeconds);
        }
        this.emit(ClientEvent.JOB_EVENT, event);
      };
    }

    if (!this.chatTokenEventHandler) {
      this.chatTokenEventHandler = (chunk: ChatCompletionChunk) => {
        this.emit(ClientEvent.CHAT_TOKEN, chunk);
      };
    }

    if (!this.chatCompletedEventHandler) {
      this.chatCompletedEventHandler = (result: ChatCompletionResult) => {
        this.emit(ClientEvent.CHAT_COMPLETED, result);
      };
    }

    if (!this.chatErrorEventHandler) {
      this.chatErrorEventHandler = (error: ChatErrorData) => {
        this.emit(ClientEvent.CHAT_ERROR, error);
      };
    }

    if (!this.chatJobStateEventHandler) {
      this.chatJobStateEventHandler = (state: ChatJobStateEvent) => {
        this.emit(ClientEvent.CHAT_JOB_STATE, state);
      };
    }

    if (!this.chatModelsUpdatedEventHandler) {
      this.chatModelsUpdatedEventHandler = (models: Record<string, LLMModelInfo>) => {
        this.emit(ClientEvent.CHAT_MODELS_UPDATED, models);
      };
    }

    this.client.projects.on('project', this.projectEventHandler);
    this.client.projects.on('job', this.jobEventHandler);
    this.client.chat.on('token', this.chatTokenEventHandler);
    this.client.chat.on('completed', this.chatCompletedEventHandler);
    this.client.chat.on('error', this.chatErrorEventHandler);
    this.client.chat.on('jobState', this.chatJobStateEventHandler);
    this.client.chat.on('modelsUpdated', this.chatModelsUpdatedEventHandler);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.isReconnecting = true;
    this.updateConnectionState({
      status: 'reconnecting' as ConnectionStatus,
      reconnectAttempts: this.connectionState.reconnectAttempts + 1,
    });

    this.emit(ClientEvent.RECONNECTING, this.connectionState.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        await this.connect();
        this.isReconnecting = false;
        this.emit(ClientEvent.RECONNECTED);
      } catch (error) {
        this.log('Reconnection failed:', error);
        
        if (this.config.reconnect) {
          this.scheduleReconnect();
        } else {
          this.isReconnecting = false;
        }
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Update connection state
   */
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = {
      ...this.connectionState,
      ...updates,
    };
  }

  /**
   * Await a promise with a timeout (clears the timer on settle)
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new SogniTimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Get recommended settings for a model
   */
  private getRecommendedSettings(modelId: string): ModelInfo['recommendedSettings'] {
    if (isSeedanceVideoModel(modelId) || this.isHappyHorseModel(modelId)) {
      return { fps: 24 };
    }

    if (this.isWanModel(modelId)) {
      return { steps: modelId.includes('lightx2v') ? 4 : 20, fps: 16, frames: 81 };
    }

    if (this.isLtx2Model(modelId)) {
      return { steps: modelId.includes('distilled') ? 4 : 20, fps: 24, frames: 121 };
    }

    // Qwen Image Edit models
    if (modelId.includes('qwen_image_edit')) {
      if (modelId.includes('lightning')) {
        return { steps: 4, guidance: 1.0 };
      }
      return { steps: 20, guidance: 4.0 };
    }

    // Provide sensible defaults based on model type
    if (modelId.includes('flux')) {
      return { steps: 4, guidance: 3.5 };
    }
    if (modelId.includes('lightning') || modelId.includes('turbo') || modelId.includes('lcm')) {
      return { steps: 4, guidance: 1.0 };
    }
    if (modelId.includes('ace-step')) {
      return { steps: 20 };
    }
    return { steps: 20, guidance: 7.5 };
  }

  private isWanModel(modelId: string): boolean {
    return isWanVideoModel(modelId);
  }

  private isLtx2Model(modelId: string): boolean {
    return isLtxVideoModel(modelId);
  }

  private isHappyHorseModel(modelId: string): boolean {
    return isHappyHorseVideoModel(modelId);
  }

  private isWan3Model(modelId: string): boolean {
    return isRegisteredWan3VideoModelId(modelId);
  }

  private getVideoDurationBounds(modelId: string): { min: number; max: number } {
    if (this.isWan3Model(modelId)) {
      return { min: 2, max: 30 };
    }
    if (isSeedanceVideoModel(modelId)) {
      // Seedance 2.5 renders up to 30s in a single call; the 2.0 family stops at 15s.
      return { min: 4, max: isSeedance25VideoModel(modelId) ? 30 : 15 };
    }
    if (this.isHappyHorseModel(modelId)) {
      return { min: 3, max: 15 };
    }
    if (this.isLtx2Model(modelId)) {
      return { min: 1, max: 20 };
    }
    return { min: 1, max: 10 };
  }

  private getVideoGenerationFps(modelId: string, fps: number): number {
    if (this.isWanModel(modelId)) {
      return 16;
    }
    if (this.isWan3Model(modelId)) {
      return 30;
    }
    if (isSeedanceVideoModel(modelId) || this.isHappyHorseModel(modelId)) {
      return 24;
    }
    return fps;
  }

  private getVideoFps(modelId: string, fps: number | undefined): number {
    if (this.isWan3Model(modelId)) {
      if (fps !== undefined && fps !== 30) {
        throw new SogniValidationError('Wan 3 video models require fps to be 30');
      }
      return 30;
    }

    if (isSeedanceVideoModel(modelId) || this.isHappyHorseModel(modelId)) {
      if (fps !== undefined && fps !== 24) {
        throw new SogniValidationError(
          this.isHappyHorseModel(modelId)
            ? 'HappyHorse video models require fps to be 24'
            : 'Seedance video models require fps to be 24',
        );
      }
      return 24;
    }

    if (fps === undefined) {
      return this.isWanModel(modelId) ? 16 : 24;
    }

    return fps;
  }

  private calculateVideoFrames(modelId: string, duration: number, fps: number): number {
    if (this.isWanModel(modelId)) {
      return Math.round(duration * 16) + 1;
    }

    if (this.isWan3Model(modelId)) {
      return Math.round(duration * 30) + 1;
    }

    if (isSeedanceVideoModel(modelId) || this.isHappyHorseModel(modelId)) {
      return Math.round(duration * 24) + 1;
    }

    let frames = Math.round(duration * fps) + 1;
    if (this.isLtx2Model(modelId)) {
      const n = Math.round((frames - 1) / LTX2_FRAME_STEP);
      frames = n * LTX2_FRAME_STEP + 1;
    }
    return frames;
  }

  /**
   * Sanitize configuration for logging
   */
  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    if (sanitized.password) sanitized.password = '***';
    return sanitized;
  }

  /**
   * Log debug messages
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[SogniClientWrapper]', ...args);
    }
  }

  /**
   * Type-safe event listener
   */
  on<E extends ClientEvent>(event: E, listener: ClientEventCallbacks[E]): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event emitter
   */
  emit<E extends ClientEvent>(event: E, ...args: Parameters<ClientEventCallbacks[E]>): boolean {
    return super.emit(event, ...args);
  }
}
