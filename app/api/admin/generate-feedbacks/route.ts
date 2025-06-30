import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyFeedbacks } from '@/lib/services/feedback-generation';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development or with admin access
    if (process.env.NODE_ENV === 'production') {
      // In production, check for admin user
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      // You can add additional admin checks here
      // For now, we'll allow any authenticated user in production
    }
    
    console.log('Manual feedback generation triggered');
    await generateDailyFeedbacks();
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Feedback generation completed successfully',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Manual feedback generation failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Feedback generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Manual feedback generation endpoint',
      note: 'Use POST to trigger feedback generation',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}