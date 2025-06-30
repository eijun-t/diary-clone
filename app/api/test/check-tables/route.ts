import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // For now, let's skip auth and use service role to check tables
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const tableChecks = {
      characters: { exists: false, count: 0, error: null },
      feedbacks: { exists: false, count: 0, error: null },
      diaries: { exists: false, count: 0, error: null }
    };

    // Check characters table
    try {
      const { data: charData, error: charError } = await adminSupabase
        .from('characters')
        .select('id, name')
        .limit(1);
      
      tableChecks.characters.exists = !charError;
      
      if (!charError && charData) {
        const { count } = await adminSupabase
          .from('characters')
          .select('*', { count: 'exact', head: true });
        tableChecks.characters.count = count || 0;
      } else {
        tableChecks.characters.error = charError?.message || 'Table not found';
      }
    } catch (err) {
      tableChecks.characters.error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Check feedbacks table
    try {
      const { data: feedData, error: feedError } = await adminSupabase
        .from('feedbacks')
        .select('id')
        .limit(1);
      
      tableChecks.feedbacks.exists = !feedError;
      
      if (!feedError && feedData !== null) {
        const { count } = await adminSupabase
          .from('feedbacks')
          .select('*', { count: 'exact', head: true });
        tableChecks.feedbacks.count = count || 0;
      } else {
        tableChecks.feedbacks.error = feedError?.message || 'Table not found';
      }
    } catch (err) {
      tableChecks.feedbacks.error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Check diaries table (should exist)
    try {
      const { data: diaryData, error: diaryError } = await adminSupabase
        .from('diaries')
        .select('id')
        .limit(1);
      
      tableChecks.diaries.exists = !diaryError;
      
      if (!diaryError && diaryData !== null) {
        const { count } = await adminSupabase
          .from('diaries')
          .select('*', { count: 'exact', head: true });
        tableChecks.diaries.count = count || 0;
      } else {
        tableChecks.diaries.error = diaryError?.message || 'Table not found';
      }
    } catch (err) {
      tableChecks.diaries.error = err instanceof Error ? err.message : 'Unknown error';
    }

    return NextResponse.json({
      success: true,
      tables: tableChecks,
      next_steps: {
        if_no_characters: 'Run the character schema SQL in Supabase dashboard or use the create schema button',
        if_no_diaries: 'Create a diary entry first',
        if_ready: 'All tables exist, ready to create sample feedback'
      }
    });

  } catch (error) {
    console.error('Error checking tables:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}