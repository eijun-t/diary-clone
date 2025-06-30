import { NextRequest, NextResponse } from 'next/server';
import { dailyFeedbackCronJob } from '@/lib/services/feedback-generation';

export async function POST(request: NextRequest) {
  // Verify the request is from a legitimate cron service
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (!expectedToken) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }
  
  if (authHeader !== `Bearer ${expectedToken}`) {
    console.error('Unauthorized cron request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    console.log('Daily feedback cron job triggered');
    await dailyFeedbackCronJob();
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Daily feedback generation completed successfully',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Daily feedback cron job failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Daily feedback generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
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