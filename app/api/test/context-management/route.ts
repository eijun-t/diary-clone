import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processWeeklyContextForUser, buildContextForChat } from '@/lib/services/context-management';
import { collectAllContextForCharacter } from '@/lib/services/context-collection';

export async function POST(request: NextRequest) {
  try {
    // For testing purposes, use a fixed test user ID instead of requiring authentication
    const TEST_USER_ID = 'test-user-id-12345';
    const supabase = await createClient();

    const body = await request.json();
    const { action, characterId, testTimeWindow } = body;
    
    // Use test user ID for all operations
    const user = { id: TEST_USER_ID };

    switch (action) {
      case 'collect_context':
        if (!characterId) {
          return NextResponse.json(
            { error: 'Character ID required for collect_context' },
            { status: 400 }
          );
        }
        
        await collectAllContextForCharacter(user.id, characterId);
        
        return NextResponse.json({
          success: true,
          message: `Context collected for user ${user.id}, character ${characterId}`
        });

      case 'process_weekly':
        await processWeeklyContextForUser(user.id);
        
        return NextResponse.json({
          success: true,
          message: `Weekly context processed for user ${user.id}`
        });

      case 'build_chat_context':
        if (!characterId) {
          return NextResponse.json(
            { error: 'Character ID required for build_chat_context' },
            { status: 400 }
          );
        }
        
        const chatContext = await buildContextForChat(user.id, characterId);
        
        return NextResponse.json({
          success: true,
          context: chatContext,
          contextLength: chatContext.length,
          estimatedTokens: Math.ceil(chatContext.length / 4)
        });

      case 'view_context_data':
        if (!characterId) {
          return NextResponse.json(
            { error: 'Character ID required for view_context_data' },
            { status: 400 }
          );
        }

        // Get raw context data
        const { data: rawContext } = await supabase
          .from('character_context_raw')
          .select('*')
          .eq('user_id', user.id)
          .eq('character_id', characterId)
          .order('created_at', { ascending: false })
          .limit(20);

        // Get summaries
        const { data: summaries } = await supabase
          .from('character_context_summaries')
          .select('*')
          .eq('user_id', user.id)
          .eq('character_id', characterId)
          .order('period_start', { ascending: false });

        return NextResponse.json({
          success: true,
          rawContext: rawContext || [],
          summaries: summaries || [],
          counts: {
            rawContext: rawContext?.length || 0,
            summaries: summaries?.length || 0,
            weeklySummaries: summaries?.filter(s => s.summary_type === 'weekly').length || 0,
            superWeeklySummaries: summaries?.filter(s => s.summary_type === 'super_weekly').length || 0
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in context management test:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for health check and info
export async function GET() {
  return NextResponse.json({
    message: 'Context Management Test API',
    availableActions: [
      'collect_context - Collect context for a specific character',
      'process_weekly - Process weekly summaries for current user',
      'build_chat_context - Build context string for chat',
      'view_context_data - View stored context data'
    ],
    usage: 'POST with { action, characterId? }'
  });
}