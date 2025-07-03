import { generateWeeklySummary, checkAndGenerateSuperWeeklySummary } from './context-summarization';
import { collectAllContextForCharacter } from './context-collection';
import { cleanupOldRawContext, getRecentSummaries, getRawContextForPeriod } from '@/lib/database/character-context';
import { ContextTimeWindow, CharacterContextSummary, CharacterContextRaw } from '@/lib/types/context';
import { createClient } from '@/lib/supabase/server';

/**
 * Main context management orchestration functions
 */

export async function processWeeklyContextForUser(userId: string): Promise<void> {
  console.log(`Processing weekly context for user: ${userId}`);
  
  const supabase = await createClient();
  
  // Get all characters
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name');

  if (!characters || characters.length === 0) {
    console.log('No characters found');
    return;
  }

  // Calculate the previous week's time window
  const timeWindow = calculatePreviousWeekWindow();

  // Process each character
  for (const character of characters) {
    await processWeeklyContextForUserCharacter(userId, character.id, timeWindow);
  }
}

export async function processWeeklyContextForUserCharacter(
  userId: string,
  characterId: number,
  timeWindow: ContextTimeWindow
): Promise<void> {
  try {
    // Step 1: Collect fresh context data for the time window
    await collectAllContextForCharacter(userId, characterId, timeWindow);

    // Step 2: Generate weekly summary
    const summary = await generateWeeklySummary(userId, characterId, timeWindow);
    
    if (summary) {
      console.log(`Generated weekly summary for user ${userId}, character ${characterId}`);
      
      // Step 3: Check if we should generate a super weekly summary
      await checkAndGenerateSuperWeeklySummary(userId, characterId);
    } else {
      console.log(`No data to summarize for user ${userId}, character ${characterId}`);
    }
  } catch (error) {
    console.error(`Error processing weekly context for user ${userId}, character ${characterId}:`, error);
  }
}

export async function processWeeklyContextForAllUsers(): Promise<void> {
  try {
    console.log('Starting weekly context processing for all users...');
    
    // Get all active users (users who have diary entries or chat activity)
    const activeUsers = await getActiveUsers();
    
    console.log(`Found ${activeUsers.length} active users to process`);

    // Process each user
    for (const userId of activeUsers) {
      await processWeeklyContextForUser(userId);
    }

    // Cleanup old raw context data (older than 1 week)
    const cleanedCount = await cleanupOldRawContext(7);
    console.log(`Cleaned up ${cleanedCount} old raw context records`);

    console.log('Completed weekly context processing for all users');
  } catch (error) {
    console.error('Error in weekly context processing:', error);
  }
}

/**
 * Context retrieval for chat integration
 */

export async function buildContextForChat(
  userId: string,
  characterId: number,
  maxTokens: number = 2000
): Promise<string> {
  try {
    // Get recent raw context (last 3 days)
    const recentRaw = await getRawContextForPeriod(
      userId,
      characterId,
      {
        start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        end: new Date()
      }
    );

    // Get recent summaries (last 5 summaries of each type)
    const recentSummaries = await getRecentSummaries(userId, characterId, 5);

    // Build context string
    let context = '';
    let tokenCount = 0;

    // Add recent summaries first (most compressed information)
    const superWeeklySummaries = recentSummaries.filter(s => s.summary_type === 'super_weekly');
    const weeklySummaries = recentSummaries.filter(s => s.summary_type === 'weekly');

    // Super weekly summaries (highest level context)
    if (superWeeklySummaries.length > 0) {
      context += '## Long-term Context:\n';
      for (const summary of superWeeklySummaries.slice(0, 2)) { // Last 2 super weekly
        const summaryText = `Period: ${formatDateRange(summary.period_start, summary.period_end)}\n${summary.summary_content}\n\n`;
        if (tokenCount + estimateTokens(summaryText) <= maxTokens * 0.4) {
          context += summaryText;
          tokenCount += estimateTokens(summaryText);
        }
      }
    }

    // Weekly summaries (medium-term context)
    if (weeklySummaries.length > 0 && tokenCount < maxTokens * 0.7) {
      context += '## Recent Weekly Context:\n';
      for (const summary of weeklySummaries.slice(0, 3)) { // Last 3 weekly
        const summaryText = `Week: ${formatDateRange(summary.period_start, summary.period_end)}\n${summary.summary_content}\n\n`;
        if (tokenCount + estimateTokens(summaryText) <= maxTokens * 0.7) {
          context += summaryText;
          tokenCount += estimateTokens(summaryText);
        }
      }
    }

    // Recent raw context (immediate context)
    if (recentRaw.length > 0 && tokenCount < maxTokens * 0.9) {
      context += '## Recent Activity:\n';
      
      // Group by content type
      const recentByType = {
        diary: recentRaw.filter(r => r.content_type === 'diary'),
        feedback: recentRaw.filter(r => r.content_type === 'feedback'),
        chat: recentRaw.filter(r => r.content_type === 'chat')
      };

      // Add recent diary entries
      for (const diary of recentByType.diary.slice(-3)) { // Last 3 diary entries
        const diaryText = `Recent diary: ${diary.content}\n`;
        if (tokenCount + estimateTokens(diaryText) <= maxTokens) {
          context += diaryText;
          tokenCount += estimateTokens(diaryText);
        }
      }

      // Add recent feedback
      for (const feedback of recentByType.feedback.slice(-2)) { // Last 2 feedback items
        const feedbackText = `Recent feedback: ${feedback.content}\n`;
        if (tokenCount + estimateTokens(feedbackText) <= maxTokens) {
          context += feedbackText;
          tokenCount += estimateTokens(feedbackText);
        }
      }
    }

    return context;
  } catch (error) {
    console.error('Error building context for chat:', error);
    return '';
  }
}

/**
 * Helper functions
 */

function calculatePreviousWeekWindow(): ContextTimeWindow {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  // Set to start/end of day for cleaner time windows
  const start = new Date(twoWeeksAgo);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(lastWeek);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

async function getActiveUsers(): Promise<string[]> {
  const supabase = await createClient();
  
  // Get users who have diary entries or chat messages in the last 2 weeks
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  
  const [diaryUsers, chatUsers] = await Promise.all([
    supabase
      .from('diaries')
      .select('user_id')
      .gte('created_at', twoWeeksAgo.toISOString()),
    supabase
      .from('chat_sessions')
      .select('user_id')
      .gte('last_message_at', twoWeeksAgo.toISOString())
  ]);

  const userIds = new Set<string>();
  
  if (diaryUsers.data) {
    diaryUsers.data.forEach(d => userIds.add(d.user_id));
  }
  
  if (chatUsers.data) {
    chatUsers.data.forEach(c => userIds.add(c.user_id));
  }

  return Array.from(userIds);
}

function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for Japanese/English mixed text
  return Math.ceil(text.length / 4);
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start).toLocaleDateString('ja-JP');
  const endDate = new Date(end).toLocaleDateString('ja-JP');
  return `${startDate} - ${endDate}`;
}