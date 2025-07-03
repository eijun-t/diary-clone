// 日次フィードバック生成のテストスクリプト

console.log('🧪 Testing daily feedback generation...\n');

async function testDailyFeedbackAPI() {
  try {
    // まずヘルスチェック
    console.log('1️⃣ Testing health check endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/cron/daily-feedback', {
      method: 'GET',
    });
    
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    console.log('');
    
    // 認証なしでのテスト（エラーを期待）
    console.log('2️⃣ Testing without authentication (should fail)...');
    const noAuthResponse = await fetch('http://localhost:3000/api/cron/daily-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const noAuthData = await noAuthResponse.json();
    console.log(`❌ Expected error (status ${noAuthResponse.status}):`, noAuthData.error);
    console.log('');
    
    // 正しい認証でのテスト
    console.log('3️⃣ Testing with authentication...');
    const testToken = process.env.CRON_SECRET_TOKEN || 'test-secret-token';
    
    const authResponse = await fetch('http://localhost:3000/api/cron/daily-feedback', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    const authData = await authResponse.json();
    
    if (authResponse.ok) {
      console.log('✅ Daily feedback generation test completed:');
      console.log(`📊 Users processed: ${authData.usersProcessed}`);
      console.log(`⚠️ Users failed: ${authData.usersFailed}`);
      console.log(`⏱️ Duration: ${authData.duration}ms`);
      console.log(`🕐 Execution time: ${authData.executionTime}`);
    } else {
      console.log(`❌ Daily feedback generation failed (status ${authResponse.status}):`);
      console.log(authData);
    }
    
  } catch (error) {
    console.error('💥 Test script failed:', error);
  }
}

// 環境変数の読み込み
import { readFileSync } from 'fs';
try {
  const envFile = readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
} catch (error) {
  console.warn('⚠️ Could not load .env file');
}

testDailyFeedbackAPI();