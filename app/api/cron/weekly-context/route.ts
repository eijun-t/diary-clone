import { NextRequest, NextResponse } from 'next/server';
import { processWeeklyContextForAllUsers } from '@/lib/services/context-management';

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      console.error('Unauthorized weekly context cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting weekly context processing cron job...');
    
    const startTime = Date.now();
    
    // Run the weekly context processing
    await processWeeklyContextForAllUsers();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Weekly context processing completed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'Weekly context processing completed successfully',
      duration: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in weekly context cron job:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during weekly context processing',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Handle GET requests for health checks
export async function GET() {
  return NextResponse.json({
    message: 'Weekly context cron endpoint is healthy',
    timestamp: new Date().toISOString()
  });
}