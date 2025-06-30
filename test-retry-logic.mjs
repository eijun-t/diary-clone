// リトライロジックのテスト用スクリプト

// Mock OpenAI error scenarios
class MockOpenAIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Error classification function (copied from feedbackGenerator.ts)
function classifyOpenAIError(error) {
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

// Calculate delay function
function calculateDelay(attempt, config) {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry logic (simplified)
async function retryableApiCall(apiCall, retryConfig, context = 'API call') {
  let lastError;
  
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

// Test scenarios
async function testRetryLogic() {
  console.log('=== リトライロジックテスト ===\n');

  const retryConfig = {
    maxRetries: 3,
    baseDelay: 500, // Shorter delays for testing
    maxDelay: 5000,
    backoffMultiplier: 2
  };

  // Test 1: Rate limit error (should retry)
  console.log('📊 Test 1: Rate limit error (should retry)');
  try {
    let attemptCount = 0;
    const result = await retryableApiCall(
      async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new MockOpenAIError('Rate limit exceeded', 429, 'rate_limit_exceeded');
        }
        return { success: true, message: 'API call succeeded' };
      },
      retryConfig,
      'Rate limit test'
    );
    console.log('✅ Test 1 passed:', result);
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Authentication error (should not retry)
  console.log('🔐 Test 2: Authentication error (should not retry)');
  try {
    const result = await retryableApiCall(
      async () => {
        throw new MockOpenAIError('Invalid API key', 401, 'invalid_api_key');
      },
      retryConfig,
      'Auth error test'
    );
    console.log('❌ Test 2 should have failed');
  } catch (error) {
    console.log('✅ Test 2 passed (correctly failed):', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Server error (should retry and eventually fail)
  console.log('🖥️ Test 3: Server error (should retry and eventually fail)');
  try {
    const result = await retryableApiCall(
      async () => {
        throw new MockOpenAIError('Internal server error', 500, 'internal_error');
      },
      retryConfig,
      'Server error test'
    );
    console.log('❌ Test 3 should have failed');
  } catch (error) {
    console.log('✅ Test 3 passed (correctly failed after retries):', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Immediate success (no retries needed)
  console.log('✨ Test 4: Immediate success (no retries needed)');
  try {
    const result = await retryableApiCall(
      async () => {
        return { success: true, message: 'Immediate success' };
      },
      retryConfig,
      'Success test'
    );
    console.log('✅ Test 4 passed:', result);
  } catch (error) {
    console.log('❌ Test 4 failed:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test delay calculation
  console.log('⏱️ Test 5: Delay calculation');
  for (let attempt = 0; attempt < 4; attempt++) {
    const delay = calculateDelay(attempt, retryConfig);
    console.log(`Attempt ${attempt}: ${delay}ms delay`);
  }

  console.log('\n🎉 All retry logic tests completed!');
}

testRetryLogic().catch(console.error);