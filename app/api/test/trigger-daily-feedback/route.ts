import { NextResponse } from 'next/server';
import { dailyFeedbackCronJob } from '@/lib/services/feedback-generation';

/**
 * Playwrightのテストから手動で日次フィードバック生成をトリガーするためのAPI
 */
export async function POST() {
  console.log('🚀 Triggering daily feedback generation from test API...');
  
  try {
    const result = await dailyFeedbackCronJob();
    
    console.log('✅ Test trigger completed successfully.');
    
    return NextResponse.json({
      success: true,
      message: 'Feedback generation triggered successfully from test API.',
      data: result,
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 Test trigger failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to trigger feedback generation from test API.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ message: 'Test trigger API is active.' });
} 