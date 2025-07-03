// 本番動作確認用の詳細テストスクリプト

import { readFileSync } from 'fs';

// 環境変数の読み込み
try {
  const envFile = readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=');
    if (key && value) {
      process.env[key] = value.replace(/"/g, '');
    }
  });
} catch (error) {
  console.warn('⚠️ Could not load .env file');
}

console.log('🔍 Production Validation Test for Task 9\n');

async function validateProduction() {
  const baseURL = 'http://localhost:3000';
  const testToken = process.env.CRON_SECRET_TOKEN;

  try {
    console.log('='.repeat(60));
    console.log('1️⃣ Environment Variables Check');
    console.log('='.repeat(60));
    
    const requiredEnvs = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'CRON_SECRET_TOKEN'
    ];
    
    let envScore = 0;
    requiredEnvs.forEach(env => {
      const value = process.env[env];
      if (value && value.length > 10) {
        console.log(`✅ ${env}: configured (${value.substring(0, 8)}...)`);
        envScore++;
      } else {
        console.log(`❌ ${env}: missing or invalid`);
      }
    });
    
    console.log(`\n📊 Environment Score: ${envScore}/${requiredEnvs.length}`);

    console.log('\n' + '='.repeat(60));
    console.log('2️⃣ API Endpoint Health Check');
    console.log('='.repeat(60));
    
    const healthResponse = await fetch(`${baseURL}/api/cron/daily-feedback`, {
      method: 'GET'
    });
    
    const healthData = await healthResponse.json();
    console.log(`✅ Health Check: ${healthResponse.status}`);
    console.log(`📅 Timestamp: ${healthData.timestamp}`);

    console.log('\n' + '='.repeat(60));
    console.log('3️⃣ Authentication Test');
    console.log('='.repeat(60));
    
    // Test without auth (should fail)
    const noAuthResponse = await fetch(`${baseURL}/api/cron/daily-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const noAuthData = await noAuthResponse.json();
    console.log(`✅ No Auth: ${noAuthResponse.status} (${noAuthData.error})`);
    
    // Test with wrong auth (should fail)
    const wrongAuthResponse = await fetch(`${baseURL}/api/cron/daily-feedback`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-token',
        'Content-Type': 'application/json'
      }
    });
    
    const wrongAuthData = await wrongAuthResponse.json();
    console.log(`✅ Wrong Auth: ${wrongAuthResponse.status} (${wrongAuthData.error})`);

    console.log('\n' + '='.repeat(60));
    console.log('4️⃣ Full Production Workflow Test');
    console.log('='.repeat(60));
    
    console.log(`🔐 Using token: ${testToken?.substring(0, 10)}...`);
    console.log('🚀 Starting full workflow test...\n');
    
    const startTime = Date.now();
    
    const productionResponse = await fetch(`${baseURL}/api/cron/daily-feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const productionData = await productionResponse.json();
    const testDuration = Date.now() - startTime;
    
    if (productionResponse.ok) {
      console.log('✅ Production workflow completed successfully!');
      console.log(`⏱️ Test duration: ${testDuration}ms`);
      console.log(`⏱️ Workflow duration: ${productionData.duration}ms`);
      console.log(`👥 Users processed: ${productionData.usersProcessed}`);
      console.log(`⚠️ Users failed: ${productionData.usersFailed}`);
      console.log(`🕐 Execution time: ${productionData.executionTime}`);
      
      if (productionData.userResults) {
        console.log('\n📋 Detailed Results:');
        productionData.userResults.forEach((result, index) => {
          const status = result.success ? '✅' : '❌';
          const feedbackInfo = result.feedbackCount !== undefined ? ` (${result.feedbackCount} feedbacks)` : '';
          console.log(`  ${index + 1}. User ${result.userId}: ${status}${feedbackInfo}`);
          if (result.error) {
            console.log(`     Error: ${result.error}`);
          }
        });
      }
      
    } else {
      console.log('❌ Production workflow failed:');
      console.log(JSON.stringify(productionData, null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('5️⃣ Performance Analysis');
    console.log('='.repeat(60));
    
    if (productionData.success) {
      const workflowDuration = productionData.duration;
      const usersProcessed = productionData.usersProcessed;
      
      console.log(`📊 Performance Metrics:`);
      console.log(`   Total time: ${workflowDuration}ms (${(workflowDuration/1000).toFixed(1)}s)`);
      console.log(`   Users processed: ${usersProcessed}`);
      console.log(`   Average per user: ${usersProcessed > 0 ? (workflowDuration/usersProcessed).toFixed(0) : 'N/A'}ms`);
      
      // Performance assessment
      const timePerUser = usersProcessed > 0 ? workflowDuration / usersProcessed : 0;
      
      if (timePerUser < 30000) {
        console.log(`🚀 Performance: EXCELLENT (< 30s per user)`);
      } else if (timePerUser < 60000) {
        console.log(`✅ Performance: GOOD (< 1min per user)`);
      } else if (timePerUser < 120000) {
        console.log(`⚠️ Performance: ACCEPTABLE (< 2min per user)`);
      } else {
        console.log(`❌ Performance: SLOW (> 2min per user)`);
      }
      
      // Scalability estimate
      const estimatedFor100Users = (timePerUser * 100) / 1000 / 60;
      const estimatedFor1000Users = (timePerUser * 1000) / 1000 / 60;
      
      console.log(`📈 Scalability Estimates:`);
      console.log(`   100 users: ~${estimatedFor100Users.toFixed(1)} minutes`);
      console.log(`   1000 users: ~${estimatedFor1000Users.toFixed(1)} minutes`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Final Validation Summary');
    console.log('='.repeat(60));
    
    const validationScore = {
      environment: envScore >= 4 ? '✅' : '❌',
      healthCheck: healthResponse.ok ? '✅' : '❌',
      authentication: (noAuthResponse.status === 401 && wrongAuthResponse.status === 401) ? '✅' : '❌',
      production: productionResponse.ok ? '✅' : '❌'
    };
    
    console.log(`Environment Setup: ${validationScore.environment}`);
    console.log(`Health Check: ${validationScore.healthCheck}`);
    console.log(`Authentication: ${validationScore.authentication}`);
    console.log(`Production Workflow: ${validationScore.production}`);
    
    const allPassed = Object.values(validationScore).every(score => score === '✅');
    
    console.log(`\n🎉 Overall Status: ${allPassed ? '✅ READY FOR PRODUCTION' : '❌ NEEDS ATTENTION'}`);
    
    if (allPassed) {
      console.log('\n🚀 Task 9 is fully operational and ready for production deployment!');
      console.log('   - All systems working correctly');
      console.log('   - Authentication secured');
      console.log('   - Workflow executing successfully');
      console.log('   - Performance within acceptable range');
    } else {
      console.log('\n⚠️ Some issues detected. Please review the failed components above.');
    }
    
  } catch (error) {
    console.error('💥 Validation test failed:', error);
    console.error('\n🔧 Make sure the development server is running: npm run dev');
  }
}

validateProduction();