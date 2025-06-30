import { Character } from '@/lib/types/character';
import { generateDailyFeedbacks, FeedbackGenerationOptions } from './feedbackGenerator';
import { saveDailyFeedbacks } from './feedbackStorage';
import { DiaryEntry } from './feedbackPrompt';

export interface FeedbackWorkflowResult {
  success: boolean;
  diaryProcessed: {
    id: number;
    content: string;
    date: string;
    mood: string;
  };
  generation: {
    successful: number;
    failed: number;
    totalTokens: number;
    charactersFailed: string[];
  };
  storage: {
    saved: number;
    failed: number;
    duplicatesSkipped: number;
    savedFeedbackIds: string[];
  };
  timing: {
    generationTime: number;
    storageTime: number;
    totalTime: number;
  };
  errors?: string[];
}

/**
 * 日記エントリから完全なフィードバック生成・保存ワークフローを実行
 */
export async function executeCompleteFeedbackWorkflow(
  diaryEntry: DiaryEntry,
  userId: string,
  characters: Character[],
  options: FeedbackGenerationOptions = {}
): Promise<FeedbackWorkflowResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`🚀 Starting complete feedback workflow for diary ${diaryEntry.id}`);

  try {
    // Step 1: フィードバック生成
    console.log('📝 Step 1: Generating feedbacks with OpenAI...');
    const generationStartTime = Date.now();

    const generationResult = await generateDailyFeedbacks(diaryEntry, characters, options);
    
    const generationTime = Date.now() - generationStartTime;
    console.log(`⏱️ Generation completed in ${generationTime}ms`);

    if (generationResult.failed.length > 0) {
      generationResult.failed.forEach(failure => {
        errors.push(`Generation failed for ${failure.characterName}: ${failure.error}`);
      });
    }

    // Step 2: データベース保存
    console.log('💾 Step 2: Saving feedbacks to database...');
    const storageStartTime = Date.now();

    const storageResult = await saveDailyFeedbacks(
      generationResult.successful,
      userId,
      diaryEntry.created_at,
      diaryEntry.id
    );

    const storageTime = Date.now() - storageStartTime;
    console.log(`⏱️ Storage completed in ${storageTime}ms`);

    if (storageResult.failed.length > 0) {
      storageResult.failed.forEach(failure => {
        errors.push(`Storage failed for ${failure.characterName}: ${failure.error}`);
      });
    }

    const totalTime = Date.now() - startTime;

    const result: FeedbackWorkflowResult = {
      success: generationResult.successful.length > 0 && storageResult.successful.length > 0,
      diaryProcessed: {
        id: diaryEntry.id,
        content: diaryEntry.content.substring(0, 100) + (diaryEntry.content.length > 100 ? '...' : ''),
        date: new Date(diaryEntry.created_at).toLocaleDateString('ja-JP'),
        mood: diaryEntry.mood
      },
      generation: {
        successful: generationResult.summary.successful,
        failed: generationResult.summary.failed,
        totalTokens: generationResult.summary.totalTokens,
        charactersFailed: generationResult.failed.map(f => f.characterName)
      },
      storage: {
        saved: storageResult.summary.saved,
        failed: storageResult.summary.failed,
        duplicatesSkipped: storageResult.duplicatesSkipped || 0,
        savedFeedbackIds: storageResult.successful
      },
      timing: {
        generationTime,
        storageTime,
        totalTime
      },
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`✅ Workflow completed successfully in ${totalTime}ms`);
    console.log(`📊 Results: ${result.storage.saved} feedbacks saved, ${result.generation.totalTokens} tokens used`);

    return result;

  } catch (error) {
    console.error('❌ Workflow failed with unexpected error:', error);
    
    return {
      success: false,
      diaryProcessed: {
        id: diaryEntry.id,
        content: diaryEntry.content.substring(0, 100),
        date: new Date(diaryEntry.created_at).toLocaleDateString('ja-JP'),
        mood: diaryEntry.mood
      },
      generation: {
        successful: 0,
        failed: 0,
        totalTokens: 0,
        charactersFailed: []
      },
      storage: {
        saved: 0,
        failed: 0,
        duplicatesSkipped: 0,
        savedFeedbackIds: []
      },
      timing: {
        generationTime: 0,
        storageTime: 0,
        totalTime: Date.now() - startTime
      },
      errors: [error instanceof Error ? error.message : 'Unknown workflow error']
    };
  }
}

/**
 * 複数の日記エントリに対してバッチ処理
 */
export async function executeBatchFeedbackWorkflow(
  diaryEntries: DiaryEntry[],
  userId: string,
  characters: Character[],
  options: FeedbackGenerationOptions = {}
): Promise<{
  results: FeedbackWorkflowResult[];
  summary: {
    totalDiaries: number;
    successfulWorkflows: number;
    failedWorkflows: number;
    totalFeedbacksGenerated: number;
    totalFeedbacksSaved: number;
    totalTokensUsed: number;
    totalTime: number;
  };
}> {
  const startTime = Date.now();
  
  console.log(`🔄 Starting batch feedback workflow for ${diaryEntries.length} diary entries`);

  const results: FeedbackWorkflowResult[] = [];

  for (const diaryEntry of diaryEntries) {
    try {
      const result = await executeCompleteFeedbackWorkflow(diaryEntry, userId, characters, options);
      results.push(result);
      
      // レート制限を避けるため短時間待機
      if (diaryEntries.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing diary ${diaryEntry.id}:`, error);
      // エラーが発生してもバッチ処理を続行
    }
  }

  const summary = {
    totalDiaries: diaryEntries.length,
    successfulWorkflows: results.filter(r => r.success).length,
    failedWorkflows: results.filter(r => !r.success).length,
    totalFeedbacksGenerated: results.reduce((sum, r) => sum + r.generation.successful, 0),
    totalFeedbacksSaved: results.reduce((sum, r) => sum + r.storage.saved, 0),
    totalTokensUsed: results.reduce((sum, r) => sum + r.generation.totalTokens, 0),
    totalTime: Date.now() - startTime
  };

  console.log(`✅ Batch workflow completed:`, summary);

  return { results, summary };
}