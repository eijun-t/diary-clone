import { NextRequest, NextResponse } from 'next/server';
import { dailyFeedbackCronJob } from '@/lib/services/feedback-generation';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // セキュリティ認証
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken) {
      console.error('❌ CRON_SECRET_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // JST時刻の確認
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const currentHour = jstTime.getHours();
    
    console.log(`🕐 Daily feedback cron triggered at JST: ${jstTime.toISOString()}`);
    console.log(`🌏 UTC time: ${now.toISOString()}`);
    
    // 実行時間の警告（午前4時±1時間の範囲外）
    if (currentHour < 3 || currentHour > 5) {
      console.warn(`⚠️ Cron executed outside expected time window. Current JST hour: ${currentHour}`);
    }
    
    // メイン処理実行
    console.log('🚀 Starting daily feedback cron job...');
    const result = await dailyFeedbackCronJob();
    
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Daily feedback cron completed successfully in ${totalTime}ms`);
      
      return NextResponse.json({
        success: true,
        message: 'Daily feedback generation completed successfully',
        executionTime: jstTime.toISOString(),
        duration: totalTime,
        usersProcessed: result.usersProcessed,
        usersFailed: result.usersFailed,
        userResults: result.userResults
      }, { status: 200 });
      
    } else {
      console.error(`❌ Daily feedback cron completed with errors in ${totalTime}ms`);
      
      return NextResponse.json({
        success: false,
        message: 'Daily feedback generation completed with errors',
        error: result.error,
        executionTime: jstTime.toISOString(),
        duration: totalTime,
        usersProcessed: result.usersProcessed,
        usersFailed: result.usersFailed
      }, { status: 500 });
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('💥 Daily feedback cron API failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Critical failure in daily feedback cron',
      message: error instanceof Error ? error.message : 'Unknown error',
      executionTime: new Date().toISOString(),
      duration: totalTime
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Daily feedback cron endpoint is active',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}