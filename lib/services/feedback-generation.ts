import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/client';
import { getAllCharacters, createFeedback } from '@/lib/database/character';
import { Character } from '@/lib/types/character';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DiaryEntry {
  id: number;
  user_id: string;
  content: string;
  mood: string;
  created_at: string;
}

export async function generateDailyFeedbacks() {
  console.log('Starting daily feedback generation...');
  
  try {
    // Get all active characters
    const characters = await getAllCharacters();
    console.log(`Found ${characters.length} active characters`);
    
    // Get yesterday's diary entries (entries from the previous day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const supabase = createClient();
    const { data: diaryEntries, error } = await supabase
      .from('diaries')
      .select('id, user_id, content, mood, created_at')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());
    
    if (error) {
      console.error('Error fetching diary entries:', error);
      return;
    }
    
    if (!diaryEntries || diaryEntries.length === 0) {
      console.log('No diary entries found for yesterday');
      return;
    }
    
    console.log(`Found ${diaryEntries.length} diary entries from yesterday`);
    
    // Generate feedbacks for each diary entry and character combination
    const feedbackPromises: Promise<void>[] = [];
    
    for (const entry of diaryEntries) {
      for (const character of characters) {
        const promise = generateAndSaveFeedback(character, entry);
        feedbackPromises.push(promise);
      }
    }
    
    // Execute all feedback generations concurrently
    const results = await Promise.allSettled(feedbackPromises);
    
    // Count successes and failures
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    console.log(`Feedback generation completed. Successes: ${successes}, Failures: ${failures}`);
    
    if (failures > 0) {
      console.error('Some feedbacks failed to generate:');
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Feedback ${index + 1}:`, result.reason);
        }
      });
    }
    
  } catch (error) {
    console.error('Error in daily feedback generation:', error);
  }
}

async function generateAndSaveFeedback(character: Character, diaryEntry: DiaryEntry): Promise<void> {
  try {
    // Check if feedback already exists for this character and diary entry
    const supabase = createClient();
    const { data: existingFeedback } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('character_id', character.id)
      .eq('diary_entry_id', diaryEntry.id)
      .single();
    
    if (existingFeedback) {
      console.log(`Feedback already exists for character ${character.name} and diary entry ${diaryEntry.id}`);
      return;
    }
    
    // Generate feedback using OpenAI
    const feedback = await generateFeedbackWithOpenAI(character, diaryEntry);
    
    // Save feedback to database
    await createFeedback({
      characterId: character.id,
      userId: diaryEntry.user_id,
      diaryEntryId: diaryEntry.id,
      content: feedback,
      generatedAt: new Date(),
      isFavorited: false
    });
    
    console.log(`Generated feedback for character ${character.name} and diary entry ${diaryEntry.id}`);
    
  } catch (error) {
    console.error(`Error generating feedback for character ${character.name} and diary entry ${diaryEntry.id}:`, error);
    throw error;
  }
}

async function generateFeedbackWithOpenAI(character: Character, diaryEntry: DiaryEntry): Promise<string> {
  const prompt = createFeedbackPrompt(character, diaryEntry);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: character.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.8,
    });
    
    const feedback = response.choices[0]?.message?.content?.trim();
    
    if (!feedback) {
      throw new Error('Empty feedback generated');
    }
    
    return feedback;
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`Failed to generate feedback with OpenAI: ${error}`);
  }
}

function createFeedbackPrompt(character: Character, diaryEntry: DiaryEntry): string {
  const moodLabels: Record<string, string> = {
    happy: '嬉しい',
    sad: '悲しい',
    neutral: '普通',
    excited: '興奮',
    angry: '怒り',
    anxious: '不安',
    peaceful: '平和',
    confused: '混乱',
  };
  
  const moodText = moodLabels[diaryEntry.mood] || diaryEntry.mood;
  
  return `以下は昨日書かれた日記です。あなたのキャラクターに合った温かいフィードバックを150文字以内で書いてください。

日記の内容：
「${diaryEntry.content}」

その時の気分：${moodText}

フィードバックの要件：
- あなたの個性と話し方を活かしてください
- 共感と励ましを含めてください
- 150文字以内で簡潔に
- 読んでいて心が軽くなるような内容にしてください`;
}

// Cron job function that can be called by external schedulers
export async function dailyFeedbackCronJob() {
  const startTime = new Date();
  console.log(`Daily feedback cron job started at ${startTime.toISOString()}`);
  
  try {
    await generateDailyFeedbacks();
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    console.log(`Daily feedback cron job completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('Daily feedback cron job failed:', error);
    throw error;
  }
}