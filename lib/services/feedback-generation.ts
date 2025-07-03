import { createClient, createServiceClient } from '@/lib/supabase/server';
import { CHARACTERS } from '@/lib/types/character';
import { executeBatchFeedbackWorkflow } from '@/lib/utils/feedbackWorkflow';
import { DiaryEntry } from '@/lib/utils/feedbackPrompt';
import { 
  enqueueUser, 
  dequeueNext, 
  markCompleted, 
  markFailed, 
  saveTemporaryFeedback,
  getQueueStats 
} from '@/lib/database/feedback-queue';
import { getDiaryEntriesFor24HourWindow } from '@/lib/utils/diary-time-window';
import { storeRawContext } from '@/lib/database/character-context';

interface User {
  id: string;
  email: string;
  created_at: string;
}

/**
 * 毎日午前4時（JST）に実行される日次フィードバック生成メイン処理
 * キューシステムベースの新実装
 */
export async function generateDailyFeedbacks() {
  const startTime = Date.now();
  console.log('🚀 Starting daily feedback generation with queue system...');
  
  try {
    // Step 1: 全アクティブユーザーをキューに追加
    await enqueueAllActiveUsers();
    
    // Step 2: キューから順次処理
    const result = await processQueuedUsers();
    
    const totalTime = Date.now() - startTime;
    
    console.log(`\n🎉 Daily feedback generation completed!`);
    console.log(`📊 Summary: ${result.processed} users processed, ${result.failed} failed`);
    console.log(`⏱️ Total time: ${totalTime}ms`);
    
    return {
      success: true,
      processed: result.processed,
      failed: result.failed,
      totalTime,
      userResults: result.userResults,
      queueStats: result.finalQueueStats
    };
    
  } catch (error) {
    console.error('💥 Critical error in daily feedback generation:', error);
    throw error;
  }
}

/**
 * 全アクティブユーザーをキューに追加
 */
async function enqueueAllActiveUsers(): Promise<void> {
  console.log('📋 Enqueuing all active users...');
  
  const users = await getActiveUsers();
  console.log(`👥 Found ${users.length} active users`);
  
  if (users.length === 0) {
    console.log('ℹ️ No active users to enqueue');
    return;
  }
  
  let enqueuedCount = 0;
  let skippedCount = 0;
  
  for (const user of users) {
    try {
      // 実際のキューシステムを使用
      await enqueueUser(user.id, 0);
      console.log(`📋 Enqueued user ${user.id}`);
      enqueuedCount++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already queued')) {
        console.log(`⏭️ User ${user.id} already in queue, skipping`);
        skippedCount++;
      } else {
        console.warn(`⚠️ Could not enqueue user ${user.id} (possibly queue table unavailable):`, error);
        // キューテーブルが利用できない場合でもスキップして処理を継続
        skippedCount++;
      }
    }
  }
  
  console.log(`✅ Enqueued ${enqueuedCount} users (${skippedCount} skipped)`);
}

/**
 * キューから順次ユーザーを処理
 */
async function processQueuedUsers(): Promise<{
  processed: number;
  failed: number;
  userResults: Array<{ userId: string; success: boolean; error?: string; feedbackCount?: number }>;
  finalQueueStats: any;
}> {
  console.log('🔄 Processing queued users...');
  
  let processedUsers = 0;
  let failedUsers = 0;
  const userResults: Array<{ userId: string; success: boolean; error?: string; feedbackCount?: number }> = [];
  
  // キューシステムを使用してユーザーを処理
  try {
    // キューが空になるまで処理を継続
    while (true) {
      let queueItem;
      
      try {
        queueItem = await dequeueNext();
      } catch (queueError) {
        console.warn('⚠️ Queue system unavailable, falling back to direct user processing');
        
        // キューシステムが利用できない場合、直接ユーザー処理
        const users = await getActiveUsers();
        
        for (const user of users) {
          console.log(`\n👤 Processing user (direct): ${user.id}`);
          
          try {
            const diaryResult = await getDiaryEntriesFor24HourWindow(user.id);
            
            if (diaryResult.entries.length === 0) {
              console.log(`📖 No diary entries found for user ${user.id} in 24-hour window`);
              userResults.push({ userId: user.id, success: true, feedbackCount: 0 });
              processedUsers++;
              continue;
            }
            
            console.log(`📝 Found ${diaryResult.entries.length} diary entries for user ${user.id}`);
            
            const feedbackResult = await generateFeedbacksForUser(user.id, diaryResult.entries);
            
            console.log(`✅ User ${user.id} processed: ${feedbackResult.totalGenerated} feedbacks generated`);
            userResults.push({ 
              userId: user.id, 
              success: true, 
              feedbackCount: feedbackResult.totalGenerated 
            });
            processedUsers++;
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Failed to process user ${user.id}:`, error);
            
            userResults.push({ 
              userId: user.id, 
              success: false, 
              error: errorMessage 
            });
            failedUsers++;
          }
        }
        
        break; // 直接処理が完了したらループを抜ける
      }
      
      if (!queueItem) {
        console.log('📭 No more items in queue');
        break;
      }
      
      console.log(`\n👤 Processing user: ${queueItem.user_id} (attempt ${queueItem.retry_count + 1})`);
      
      try {
        const diaryResult = await getDiaryEntriesFor24HourWindow(queueItem.user_id);
        
        if (diaryResult.entries.length === 0) {
          console.log(`📖 No diary entries found for user ${queueItem.user_id} in 24-hour window`);
          await markCompleted(queueItem.id);
          userResults.push({ userId: queueItem.user_id, success: true, feedbackCount: 0 });
          processedUsers++;
          continue;
        }
        
        console.log(`📝 Found ${diaryResult.entries.length} diary entries for user ${queueItem.user_id}`);
        
        const feedbackResult = await generateFeedbacksForUser(queueItem.user_id, diaryResult.entries);
        
        await markCompleted(queueItem.id);
        
        console.log(`✅ User ${queueItem.user_id} processed: ${feedbackResult.totalGenerated} feedbacks generated`);
        userResults.push({ 
          userId: queueItem.user_id, 
          success: true, 
          feedbackCount: feedbackResult.totalGenerated 
        });
        processedUsers++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to process user ${queueItem.user_id}:`, error);
        
        try {
          const willRetry = await markFailed(queueItem.id, errorMessage);
          if (!willRetry) {
            userResults.push({ 
              userId: queueItem.user_id, 
              success: false, 
              error: errorMessage 
            });
            failedUsers++;
          } else {
            console.log(`🔄 User ${queueItem.user_id} will be retried`);
          }
        } catch (markError) {
          console.warn('⚠️ Could not mark queue item as failed:', markError);
          userResults.push({ 
            userId: queueItem.user_id, 
            success: false, 
            error: errorMessage 
          });
          failedUsers++;
        }
      }
    }
  } catch (processingError) {
    console.error('❌ Error in user processing loop:', processingError);
    throw processingError;
  }
  
  let finalQueueStats;
  try {
    finalQueueStats = await getQueueStats();
  } catch (statsError) {
    console.warn('⚠️ Could not get queue stats:', statsError);
    finalQueueStats = {
      pending: 0,
      processing: 0,
      completed: processedUsers,
      failed: failedUsers,
      total: processedUsers + failedUsers
    };
  }
  
  return {
    processed: processedUsers,
    failed: failedUsers,
    userResults,
    finalQueueStats
  };
}

/**
 * 単一ユーザーに対する全キャラクターフィードバック生成
 */
async function generateFeedbacksForUser(
  userId: string,
  diaryEntries: DiaryEntry[]
): Promise<{
  totalGenerated: number;
  totalFailed: number;
  characterResults: Array<{ characterId: string; success: boolean; error?: string }>;
}> {
  console.log(`🎭 Generating feedbacks for ${CHARACTERS.length} characters for user ${userId}`);
  
  let totalGenerated = 0;
  let totalFailed = 0;
  const characterResults: Array<{ characterId: string; success: boolean; error?: string }> = [];
  
  // 各キャラクターでフィードバック生成
  for (const character of CHARACTERS) {
    try {
      console.log(`🤖 Generating feedback for character: ${character.name}`);
      
      try {
        // 実際のOpenAI APIフィードバック生成
        console.log(`🤖 Generating feedback for ${character.name} with ${diaryEntries.length} diary entries`);
        
        const result = await executeBatchFeedbackWorkflow(
          diaryEntries,
          userId,
          [character], // 単一キャラクター
          {
            model: 'gpt-4o',
            maxTokens: 150,
            temperature: 0.8,
            retryConfig: {
              maxRetries: 2,
              baseDelay: 2000,
              maxDelay: 10000
            }
          }
        );
        
        // 結果の処理
        for (const workflowResult of result.results) {
          if (workflowResult.success) {
            console.log(`✅ Successfully generated feedback for ${character.name} (${workflowResult.generation.successful} successful)`);
            
            // 生成されたフィードバックを一時保存する場合
            if (workflowResult.generation.successful > 0) {
              try {
                // 既存のfeedbackStorageの結果を利用するか、一時保存テーブルに保存
                // ここでは成功をカウントのみ
                totalGenerated += workflowResult.generation.successful;
                
                // Store diary entries as context for this character (for feedback generation)
                try {
                  const diaryContent = diaryEntries.map(entry => entry.content).join('\n\n');
                  await storeRawContext(
                    userId,
                    character.id,
                    'diary',
                    diaryContent,
                    {
                      source: 'feedback_generation',
                      entry_count: diaryEntries.length,
                      feedback_date: new Date().toISOString()
                    }
                  );
                } catch (contextError) {
                  console.error(`⚠️ Failed to store context for ${character.name}:`, contextError);
                  // Don't fail the main process if context storage fails
                }
                
                console.log(`💾 Processed ${workflowResult.generation.successful} feedbacks for ${character.name}`);
              } catch (saveError) {
                console.error(`❌ Failed to process feedback results for ${character.name}:`, saveError);
                totalFailed++;
              }
            }
          } else {
            console.error(`❌ Failed to generate feedback for ${character.name}`);
            totalFailed++;
          }
        }
        
      } catch (workflowError) {
        console.error(`❌ Workflow error for ${character.name}:`, workflowError);
        totalFailed++;
      }
      
      characterResults.push({ characterId: character.id, success: true });
      
      // キャラクター間でレート制限回避
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed to generate feedback for character ${character.name}:`, error);
      characterResults.push({ 
        characterId: character.id, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      totalFailed++;
      
      // 個別キャラクターのエラーでも他のキャラクターの処理は継続
      continue;
    }
  }
  
  console.log(`📊 User ${userId} feedback generation: ${totalGenerated} generated, ${totalFailed} failed`);
  
  return {
    totalGenerated,
    totalFailed,
    characterResults
  };
}

/**
 * アクティブユーザー一覧を取得
 */
async function getActiveUsers(): Promise<User[]> {
  const supabase = createClient();
  
  try {
    // 既存のprofilesテーブルから取得を試行
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, created_at')
      .order('created_at', { ascending: true });
    
    if (!profileError && profiles && profiles.length > 0) {
      console.log(`👥 Found ${profiles.length} users from profiles table`);
      return profiles;
    }
    
    // profilesテーブルが存在しない場合、auth.usersから取得
    console.log('📋 Profiles table not available, using auth.users...');
    
    // Service role clientを使ってauth.usersにアクセス
    const serviceSupabase = createServiceClient();
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.listUsers();
    
    if (authError) {
      console.warn('⚠️ Could not access auth.users, using test data for development');
      
      // 開発環境用のフォールバック
      const fallbackUsers: User[] = [
        {
          id: 'dev-user-1',
          email: 'dev@example.com',
          created_at: new Date().toISOString()
        }
      ];
      
      console.log(`👥 Using ${fallbackUsers.length} fallback development users`);
      return fallbackUsers;
    }
    
    const users: User[] = authData.users.map(user => ({
      id: user.id,
      email: user.email || 'no-email@example.com',
      created_at: user.created_at
    }));
    
    console.log(`👥 Found ${users.length} users from auth.users`);
    return users;
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    
    // エラー時のフォールバック
    const fallbackUsers: User[] = [
      {
        id: 'fallback-user-1',
        email: 'fallback@example.com',
        created_at: new Date().toISOString()
      }
    ];
    
    console.log(`👥 Error fallback: using ${fallbackUsers.length} users`);
    return fallbackUsers;
  }
}

/**
 * 外部cronサービスから呼び出されるメイン関数
 * 毎日午前4時（JST）に実行される
 */
export async function dailyFeedbackCronJob() {
  const startTime = new Date();
  const jstTime = new Date(startTime.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  
  console.log(`\n🕐 Daily feedback cron job started at JST: ${jstTime.toISOString()}`);
  console.log(`📍 Current UTC time: ${startTime.toISOString()}`);
  
  try {
    const result = await generateDailyFeedbacks();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`\n✅ Daily feedback cron job completed successfully`);
    console.log(`📊 Results: ${result.processed} users processed, ${result.failed} failed`);
    console.log(`⏱️ Total duration: ${duration}ms`);
    
    return {
      success: true,
      startTime: jstTime.toISOString(),
      duration,
      usersProcessed: result.processed,
      usersFailed: result.failed,
      userResults: result.userResults
    };
    
  } catch (error) {
    console.error('💥 Daily feedback cron job failed:', error);
    
    // エラーでもログは残す
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    return {
      success: false,
      startTime: jstTime.toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      usersProcessed: 0,
      usersFailed: 0
    };
  }
}