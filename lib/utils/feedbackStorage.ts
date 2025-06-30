import { createClient } from '@/lib/supabase/client';
import { GeneratedFeedback } from './feedbackGenerator';

export interface StoredFeedback {
  id: string;
  character_id: string;
  user_id: string;
  content: string;
  feedback_date: string;
  is_favorited: boolean;
  created_at: string;
  diary_entry_id?: number;
  generation_metadata?: {
    model: string;
    tokens_used?: number;
    prompt_length: number;
    generation_time: string;
  };
}

/**
 * 生成されたフィードバックをデータベースに保存
 */
export async function saveFeedbackToDatabase(
  feedback: GeneratedFeedback,
  userId: string,
  diaryEntryId?: number
): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
  try {
    const supabase = createClient();

    const feedbackData = {
      character_id: parseInt(feedback.characterId), // bigint に合わせて数値変換
      user_id: userId,
      content: feedback.content,
      feedback_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      is_favorited: false,
      diary_entry_id: diaryEntryId,
      generation_metadata: {
        model: feedback.model,
        tokens_used: feedback.tokensUsed,
        prompt_length: feedback.promptUsed.length,
        generation_time: feedback.generatedAt.toISOString()
      }
    };

    const { data, error } = await supabase
      .from('feedbacks')
      .insert(feedbackData)
      .select('id')
      .single();

    if (error) {
      console.error('Error saving feedback to database:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`✅ Feedback saved to database with ID: ${data.id}`);

    return {
      success: true,
      feedbackId: data.id
    };

  } catch (error) {
    console.error('Unexpected error saving feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 複数のフィードバックを一括保存
 */
export async function saveMultipleFeedbacks(
  feedbacks: GeneratedFeedback[],
  userId: string,
  diaryEntryId?: number
): Promise<{
  successful: string[];
  failed: Array<{ characterName: string; error: string }>;
  summary: { total: number; saved: number; failed: number };
}> {
  console.log(`💾 Saving ${feedbacks.length} feedbacks to database...`);

  const successful: string[] = [];
  const failed: Array<{ characterName: string; error: string }> = [];

  for (const feedback of feedbacks) {
    const result = await saveFeedbackToDatabase(feedback, userId, diaryEntryId);
    
    if (result.success && result.feedbackId) {
      successful.push(result.feedbackId);
    } else {
      failed.push({
        characterName: feedback.characterName,
        error: result.error || 'Unknown error'
      });
    }
  }

  const summary = {
    total: feedbacks.length,
    saved: successful.length,
    failed: failed.length
  };

  console.log(`💾 Feedback saving complete:`, summary);

  return {
    successful,
    failed,
    summary
  };
}

/**
 * 特定日付のフィードバックが既に存在するかチェック
 */
export async function checkExistingFeedbacks(
  userId: string,
  date: string
): Promise<{ exists: boolean; count: number; characterIds: string[] }> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('feedbacks')
      .select('character_id')
      .eq('user_id', userId)
      .eq('feedback_date', date);

    if (error) {
      console.error('Error checking existing feedbacks:', error);
      return { exists: false, count: 0, characterIds: [] };
    }

    const characterIds = data?.map(item => item.character_id.toString()) || [];

    return {
      exists: data && data.length > 0,
      count: data?.length || 0,
      characterIds
    };

  } catch (error) {
    console.error('Unexpected error checking existing feedbacks:', error);
    return { exists: false, count: 0, characterIds: [] };
  }
}

/**
 * 日記エントリから適切な日付を取得してフィードバック保存
 */
export async function saveDailyFeedbacks(
  feedbacks: GeneratedFeedback[],
  userId: string,
  diaryCreatedAt: string,
  diaryEntryId?: number
): Promise<{
  successful: string[];
  failed: Array<{ characterName: string; error: string }>;
  summary: { total: number; saved: number; failed: number };
  duplicatesSkipped?: number;
}> {
  // 日記の日付を取得（フィードバック日付として使用）
  const feedbackDate = new Date(diaryCreatedAt).toISOString().split('T')[0];

  // 既存のフィードバックをチェック
  const existingCheck = await checkExistingFeedbacks(userId, feedbackDate);
  
  if (existingCheck.exists) {
    console.log(`⚠️ Feedbacks already exist for ${feedbackDate}. Existing count: ${existingCheck.count}`);
    
    // 重複していないキャラクターのフィードバックのみ保存
    const newFeedbacks = feedbacks.filter(
      feedback => !existingCheck.characterIds.includes(feedback.characterId)
    );

    if (newFeedbacks.length === 0) {
      return {
        successful: [],
        failed: [],
        summary: { total: feedbacks.length, saved: 0, failed: 0 },
        duplicatesSkipped: feedbacks.length
      };
    }

    const result = await saveMultipleFeedbacks(newFeedbacks, userId, diaryEntryId);
    return {
      ...result,
      duplicatesSkipped: feedbacks.length - newFeedbacks.length
    };
  }

  // 新規保存
  return await saveMultipleFeedbacks(feedbacks, userId, diaryEntryId);
}