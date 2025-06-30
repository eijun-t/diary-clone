import OpenAI from 'openai';
import { Character } from '@/lib/types/character';
import { generateFeedbackPrompt, DiaryEntry } from './feedbackPrompt';

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface FeedbackGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  backoffMultiplier?: number;
  retryableErrors?: string[]; // Error codes/messages that should trigger retry
}

export interface GeneratedFeedback {
  characterId: string;
  characterName: string;
  content: string;
  generatedAt: Date;
  promptUsed: string;
  tokensUsed?: number;
  model: string;
}

export interface FeedbackGenerationResult {
  success: boolean;
  feedback?: GeneratedFeedback;
  error?: string;
  retryCount?: number;
  lastError?: {
    type: string;
    message: string;
    code?: string;
    statusCode?: number;
  };
}

/**
 * OpenAI APIエラーの分類
 */
function classifyOpenAIError(error: any): {
  isRetryable: boolean;
  errorType: string;
  statusCode?: number;
  code?: string;
} {
  const errorMessage = error?.message || error?.toString() || '';
  const statusCode = error?.status || error?.response?.status;
  const errorCode = error?.code || error?.error?.code;

  // Rate limit errors
  if (statusCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return { isRetryable: true, errorType: 'rate_limit', statusCode, code: errorCode };
  }

  // Server errors (5xx)
  if (statusCode >= 500) {
    return { isRetryable: true, errorType: 'server_error', statusCode, code: errorCode };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
    return { isRetryable: true, errorType: 'timeout', statusCode, code: errorCode };
  }

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
    return { isRetryable: true, errorType: 'network_error', statusCode, code: errorCode };
  }

  // Authentication errors (not retryable)
  if (statusCode === 401 || statusCode === 403) {
    return { isRetryable: false, errorType: 'auth_error', statusCode, code: errorCode };
  }

  // Bad request errors (not retryable)
  if (statusCode === 400) {
    return { isRetryable: false, errorType: 'bad_request', statusCode, code: errorCode };
  }

  // Unknown errors - conservative approach, don't retry
  return { isRetryable: false, errorType: 'unknown', statusCode, code: errorCode };
}

/**
 * Exponential backoff delay calculation
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep function for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for OpenAI API calls
 */
async function retryableApiCall<T>(
  apiCall: () => Promise<T>,
  retryConfig: Required<RetryConfig>,
  context: string = 'API call'
): Promise<{ result: T; retryCount: number; lastError?: any }> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      console.log(`🔄 ${context} - Attempt ${attempt + 1}/${retryConfig.maxRetries + 1}`);
      
      const result = await apiCall();
      
      if (attempt > 0) {
        console.log(`✅ ${context} succeeded after ${attempt} retries`);
      }
      
      return { result, retryCount: attempt };
      
    } catch (error) {
      lastError = error;
      
      const errorClassification = classifyOpenAIError(error);
      console.error(`❌ ${context} failed (attempt ${attempt + 1}):`, {
        errorType: errorClassification.errorType,
        isRetryable: errorClassification.isRetryable,
        statusCode: errorClassification.statusCode,
        message: error?.message || 'Unknown error'
      });

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === retryConfig.maxRetries || !errorClassification.isRetryable) {
        break;
      }

      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, retryConfig);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 単一キャラクターのフィードバックを生成
 */
export async function generateCharacterFeedback(
  character: Character,
  diaryEntry: DiaryEntry,
  options: FeedbackGenerationOptions = {}
): Promise<FeedbackGenerationResult> {
  const {
    model = 'gpt-4o',
    maxTokens = 200,
    temperature = 0.8,
    timeout = 30000,
    retryConfig = {}
  } = options;

  // Default retry configuration
  const defaultRetryConfig: Required<RetryConfig> = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: ['rate_limit', 'server_error', 'timeout', 'network_error'],
    ...retryConfig
  };

  try {
    // プロンプト生成
    const prompt = generateFeedbackPrompt({
      character,
      diaryEntry
    });

    console.log(`Generating feedback for ${character.name}...`);

    // リトライ可能なOpenAI API呼び出し
    const { result: completion, retryCount } = await retryableApiCall(
      async () => {
        return await Promise.race([
          openai.chat.completions.create({
            model: model,
            messages: [
              {
                role: 'system',
                content: prompt
              }
            ],
            max_tokens: maxTokens,
            temperature: temperature,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API timeout')), timeout)
          )
        ]) as OpenAI.Chat.Completions.ChatCompletion;
      },
      defaultRetryConfig,
      `Feedback generation for ${character.name}`
    );

    const feedbackContent = completion.choices[0]?.message?.content?.trim();

    if (!feedbackContent) {
      throw new Error('Empty response from OpenAI');
    }

    // フィードバック内容の基本検証
    if (feedbackContent.length < 20) {
      throw new Error('Generated feedback is too short');
    }

    if (feedbackContent.length > 300) {
      console.warn(`Feedback for ${character.name} is quite long: ${feedbackContent.length} characters`);
    }

    const result: GeneratedFeedback = {
      characterId: character.id,
      characterName: character.name,
      content: feedbackContent,
      generatedAt: new Date(),
      promptUsed: prompt,
      tokensUsed: completion.usage?.total_tokens,
      model: model
    };

    return {
      success: true,
      feedback: result,
      retryCount
    };

  } catch (error) {
    console.error(`Error generating feedback for ${character.name}:`, error);
    
    const errorClassification = classifyOpenAIError(error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      lastError: {
        type: errorClassification.errorType,
        message: error?.message || 'Unknown error',
        code: errorClassification.code,
        statusCode: errorClassification.statusCode
      }
    };
  }
}

/**
 * 複数キャラクターのフィードバックを並列生成
 */
export async function generateMultipleFeedbacks(
  characters: Character[],
  diaryEntry: DiaryEntry,
  options: FeedbackGenerationOptions = {}
): Promise<FeedbackGenerationResult[]> {
  console.log(`Generating feedbacks for ${characters.length} characters...`);

  // 並列実行でフィードバック生成
  const promises = characters.map(character => 
    generateCharacterFeedback(character, diaryEntry, options)
  );

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: `Failed to generate feedback for ${characters[index].name}: ${result.reason}`
      };
    }
  });
}

/**
 * 日記エントリに対してすべてのアクティブキャラクターからフィードバックを生成
 */
export async function generateDailyFeedbacks(
  diaryEntry: DiaryEntry,
  allCharacters: Character[],
  options: FeedbackGenerationOptions = {}
): Promise<{
  successful: GeneratedFeedback[];
  failed: Array<{ characterName: string; error: string }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTokens: number;
  };
}> {
  // アクティブなキャラクターのみフィルタ
  const activeCharacters = allCharacters.filter(char => char.isActive);

  console.log(`Generating daily feedbacks for diary entry ${diaryEntry.id} with ${activeCharacters.length} active characters`);

  const results = await generateMultipleFeedbacks(activeCharacters, diaryEntry, options);

  const successful: GeneratedFeedback[] = [];
  const failed: Array<{ characterName: string; error: string }> = [];
  let totalTokens = 0;

  results.forEach((result, index) => {
    if (result.success && result.feedback) {
      successful.push(result.feedback);
      totalTokens += result.feedback.tokensUsed || 0;
    } else {
      failed.push({
        characterName: activeCharacters[index].name,
        error: result.error || 'Unknown error'
      });
    }
  });

  const summary = {
    total: activeCharacters.length,
    successful: successful.length,
    failed: failed.length,
    totalTokens
  };

  console.log(`Feedback generation complete:`, summary);

  return {
    successful,
    failed,
    summary
  };
}

/**
 * フィードバック生成の設定検証
 */
export function validateGenerationConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY environment variable is not set');
  }

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length < 10) {
    errors.push('OPENAI_API_KEY appears to be invalid');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}