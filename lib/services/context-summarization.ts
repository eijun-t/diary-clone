import OpenAI from 'openai';
import { getRawContextForPeriod, storeSummary, getSummariesByType } from '@/lib/database/character-context';
import { CharacterContextRaw, ContextTimeWindow } from '@/lib/types/context';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate weekly summary for a user-character pair
 */
export async function generateWeeklySummary(
  userId: string,
  characterId: number,
  timeWindow: ContextTimeWindow
): Promise<string | null> {
  try {
    // Get all raw context for this period
    const rawContext = await getRawContextForPeriod(userId, characterId, timeWindow);
    
    if (rawContext.length === 0) {
      return null; // No data to summarize
    }

    // Organize context by type
    const contextByType = organizeContextByType(rawContext);
    
    // Build summarization prompt
    const prompt = buildWeeklySummaryPrompt(contextByType, timeWindow);
    
    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating concise, meaningful summaries of user-character interactions. 
          Create a summary that preserves the emotional context, key themes, and relationship development while being concise and useful for future conversations.
          Focus on the user's emotional journey, important events, and how the relationship with this character has evolved.
          Keep the summary under 800 tokens.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    });

    const summary = completion.choices[0]?.message?.content;
    
    if (!summary) {
      console.error('No summary generated from OpenAI');
      return null;
    }

    // Store the summary
    await storeSummary(
      userId,
      characterId,
      'weekly',
      timeWindow.start,
      timeWindow.end,
      summary,
      rawContext.length
    );

    return summary;
  } catch (error) {
    console.error('Error generating weekly summary:', error);
    return null;
  }
}

/**
 * Generate super weekly summary from multiple weekly summaries
 */
export async function generateSuperWeeklySummary(
  userId: string,
  characterId: number,
  weeklySummaries: string[],
  periodStart: Date,
  periodEnd: Date
): Promise<string | null> {
  try {
    if (weeklySummaries.length === 0) {
      return null;
    }

    const prompt = buildSuperWeeklySummaryPrompt(weeklySummaries, periodStart, periodEnd);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: `You are an expert at creating high-level summaries from multiple weekly summaries. 
          Create a comprehensive summary that captures the overall emotional journey, key relationship developments, 
          recurring themes, and significant changes over the longer time period.
          Focus on patterns, growth, and the evolution of the user-character relationship.
          Keep the summary under 1000 tokens while preserving essential context.`
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const summary = completion.choices[0]?.message?.content;
    
    if (!summary) {
      console.error('No super weekly summary generated from OpenAI');
      return null;
    }

    // Store the super weekly summary
    await storeSummary(
      userId,
      characterId,
      'super_weekly',
      periodStart,
      periodEnd,
      summary,
      weeklySummaries.length
    );

    return summary;
  } catch (error) {
    console.error('Error generating super weekly summary:', error);
    return null;
  }
}

/**
 * Check if super weekly summary should be generated and create it
 */
export async function checkAndGenerateSuperWeeklySummary(
  userId: string,
  characterId: number
): Promise<void> {
  try {
    // Get all weekly summaries for this user-character pair
    const weeklySummaries = await getSummariesByType(userId, characterId, 'weekly');
    
    // Check if we have 10 or more weekly summaries that haven't been processed
    if (weeklySummaries.length >= 10) {
      // Get existing super weekly summaries to determine what's already been processed
      const existingSuperWeeklies = await getSummariesByType(userId, characterId, 'super_weekly');
      
      // Find the latest processed period end
      let lastProcessedEnd = new Date(0); // Start from epoch
      if (existingSuperWeeklies.length > 0) {
        const latestSuperWeekly = existingSuperWeeklies[existingSuperWeeklies.length - 1];
        lastProcessedEnd = new Date(latestSuperWeekly.period_end);
      }
      
      // Find unprocessed weekly summaries
      const unprocessedWeeklies = weeklySummaries.filter(
        summary => new Date(summary.period_start) > lastProcessedEnd
      );
      
      // If we have 10 or more unprocessed weeklies, create a super weekly
      if (unprocessedWeeklies.length >= 10) {
        const first10 = unprocessedWeeklies.slice(0, 10);
        const summaryTexts = first10.map(s => s.summary_content);
        const periodStart = new Date(first10[0].period_start);
        const periodEnd = new Date(first10[9].period_end);
        
        await generateSuperWeeklySummary(
          userId,
          characterId,
          summaryTexts,
          periodStart,
          periodEnd
        );
      }
    }
  } catch (error) {
    console.error('Error checking/generating super weekly summary:', error);
  }
}

/**
 * Helper functions
 */

function organizeContextByType(rawContext: CharacterContextRaw[]): Record<string, string[]> {
  const organized: Record<string, string[]> = {
    chat: [],
    diary: [],
    feedback: []
  };

  for (const context of rawContext) {
    organized[context.content_type].push(context.content);
  }

  return organized;
}

function buildWeeklySummaryPrompt(
  contextByType: Record<string, string[]>,
  timeWindow: ContextTimeWindow
): string {
  const startDate = timeWindow.start.toLocaleDateString('ja-JP');
  const endDate = timeWindow.end.toLocaleDateString('ja-JP');
  
  let prompt = `Please create a comprehensive summary of the user's interactions and experiences with this character from ${startDate} to ${endDate}.\n\n`;

  if (contextByType.diary.length > 0) {
    prompt += `## Diary Entries (${contextByType.diary.length} entries):\n`;
    contextByType.diary.forEach((entry, index) => {
      prompt += `${index + 1}. ${entry}\n\n`;
    });
  }

  if (contextByType.feedback.length > 0) {
    prompt += `## Character Feedback (${contextByType.feedback.length} items):\n`;
    contextByType.feedback.forEach((feedback, index) => {
      prompt += `${index + 1}. ${feedback}\n\n`;
    });
  }

  if (contextByType.chat.length > 0) {
    prompt += `## Chat Conversations (${contextByType.chat.length} sessions):\n`;
    contextByType.chat.forEach((chat, index) => {
      prompt += `${index + 1}. ${chat}\n\n`;
    });
  }

  prompt += `\nPlease create a summary that captures:\n`;
  prompt += `- The user's emotional journey and key experiences during this week\n`;
  prompt += `- Important themes or recurring topics\n`;
  prompt += `- How the relationship with this character developed\n`;
  prompt += `- Any significant events or changes in the user's life\n`;
  prompt += `- Context that would be valuable for future conversations\n\n`;
  prompt += `Keep the summary concise but meaningful, focusing on what's most important for maintaining continuity in future interactions.`;

  return prompt;
}

function buildSuperWeeklySummaryPrompt(
  weeklySummaries: string[],
  periodStart: Date,
  periodEnd: Date
): string {
  const startDate = periodStart.toLocaleDateString('ja-JP');
  const endDate = periodEnd.toLocaleDateString('ja-JP');
  
  let prompt = `Please create a high-level summary from these ${weeklySummaries.length} weekly summaries covering the period from ${startDate} to ${endDate}:\n\n`;

  weeklySummaries.forEach((summary, index) => {
    prompt += `## Week ${index + 1}:\n${summary}\n\n`;
  });

  prompt += `Please create a comprehensive summary that captures:\n`;
  prompt += `- Overall patterns and themes across this ${weeklySummaries.length}-week period\n`;
  prompt += `- Significant emotional or life changes and developments\n`;
  prompt += `- Evolution of the relationship with this character\n`;
  prompt += `- Key recurring topics or concerns\n`;
  prompt += `- Important context for understanding the user's long-term journey\n\n`;
  prompt += `Focus on the bigger picture while preserving essential details that provide meaningful context for future interactions.`;

  return prompt;
}