import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Development only
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const supabase = createServiceClient();

    console.log('🔧 Creating feedback generation queue table...');

    // Step 1: Create feedback_generation_queue table
    const { data: queueTable, error: queueError } = await supabase
      .from('feedback_generation_queue')
      .select('*')
      .limit(1);

    if (queueError && queueError.code === 'PGRST106') {
      // Table doesn't exist, create it using SQL
      console.log('📋 Creating feedback_generation_queue table...');
      
      // We'll create a simpler version that works with existing Supabase setup
      const createQueueSQL = `
        CREATE TABLE IF NOT EXISTS feedback_generation_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          priority INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          error_message TEXT,
          metadata JSONB DEFAULT '{}'
        );
      `;

      // Use a direct query instead of RPC
      try {
        const { error: createError } = await supabase.rpc('exec', { sql: createQueueSQL });
        if (createError) {
          console.log('⚠️ RPC method failed, table might already exist or need manual creation');
        }
      } catch (err) {
        console.log('⚠️ Direct SQL execution not available, manual table creation needed');
      }
    } else {
      console.log('✅ feedback_generation_queue table already exists');
    }

    console.log('🔧 Creating temporary_feedbacks table...');

    // Step 2: Create temporary_feedbacks table
    const { data: tempTable, error: tempError } = await supabase
      .from('temporary_feedbacks')
      .select('*')
      .limit(1);

    if (tempError && tempError.code === 'PGRST106') {
      console.log('📋 Creating temporary_feedbacks table...');
      
      const createTempSQL = `
        CREATE TABLE IF NOT EXISTS temporary_feedbacks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          character_id TEXT NOT NULL,
          character_name TEXT NOT NULL,
          diary_entry_id BIGINT NOT NULL,
          content TEXT NOT NULL,
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
          model_used TEXT,
          tokens_used INTEGER,
          is_displayed BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'
        );
      `;

      try {
        const { error: createError } = await supabase.rpc('exec', { sql: createTempSQL });
        if (createError) {
          console.log('⚠️ RPC method failed, table might already exist or need manual creation');
        }
      } catch (err) {
        console.log('⚠️ Direct SQL execution not available, manual table creation needed');
      }
    } else {
      console.log('✅ temporary_feedbacks table already exists');
    }

    // Test table access
    const { data: queueTest, error: queueTestError } = await supabase
      .from('feedback_generation_queue')
      .select('count', { count: 'exact' });

    const { data: tempTest, error: tempTestError } = await supabase
      .from('temporary_feedbacks')
      .select('count', { count: 'exact' });

    const results = {
      feedback_generation_queue: {
        exists: !queueTestError,
        accessible: !queueTestError,
        count: queueTest?.[0]?.count || 0,
        error: queueTestError?.message
      },
      temporary_feedbacks: {
        exists: !tempTestError,
        accessible: !tempTestError,
        count: tempTest?.[0]?.count || 0,
        error: tempTestError?.message
      }
    };

    const allTablesReady = results.feedback_generation_queue.accessible && 
                          results.temporary_feedbacks.accessible;

    return NextResponse.json({
      success: allTablesReady,
      message: allTablesReady ? 
        'All tables are ready for production use' : 
        'Some tables need manual creation in Supabase dashboard',
      tables: results,
      instructions: allTablesReady ? null : {
        message: 'Please create tables manually in Supabase SQL editor',
        sql_file: 'lib/database/feedback-queue-schema.sql'
      }
    });

  } catch (error) {
    console.error('Error setting up tables:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Simple table creation endpoint',
    environment: process.env.NODE_ENV
  });
}