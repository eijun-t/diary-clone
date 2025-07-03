import { createClient } from '@/lib/supabase/server';

export interface QueueItem {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  metadata: Record<string, any>;
}

export interface TemporaryFeedback {
  id: string;
  user_id: string;
  character_id: string;
  character_name: string;
  diary_entry_id: number;
  content: string;
  generated_at: string;
  expires_at: string;
  model_used?: string;
  tokens_used?: number;
  is_displayed: boolean;
  metadata: Record<string, any>;
}

/**
 * キューにユーザーを追加
 */
export async function enqueueUser(userId: string, priority: number = 0): Promise<QueueItem> {
  const supabase = createClient();
  
  // 既に処理中または待機中のアイテムがないかチェック
  const { data: existing, error: checkError } = await supabase
    .from('feedback_generation_queue')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .single();
  
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to check existing queue items: ${checkError.message}`);
  }
  
  if (existing) {
    console.log(`User ${userId} already in queue with status: ${existing.status}`);
    throw new Error(`User ${userId} is already queued or being processed`);
  }
  
  const { data, error } = await supabase
    .from('feedback_generation_queue')
    .insert({
      user_id: userId,
      priority,
      metadata: { enqueued_at: new Date().toISOString() }
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to enqueue user: ${error.message}`);
  }
  
  console.log(`✅ User ${userId} enqueued with priority ${priority}`);
  return data;
}

/**
 * 次の処理対象を取得してロック
 */
export async function dequeueNext(): Promise<QueueItem | null> {
  const supabase = createClient();
  
  // 優先度順で次のアイテムを取得
  const { data: items, error: selectError } = await supabase
    .from('feedback_generation_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);
  
  if (selectError) {
    throw new Error(`Failed to select next queue item: ${selectError.message}`);
  }
  
  if (!items || items.length === 0) {
    return null;
  }
  
  const item = items[0];
  
  // ステータスを'processing'に更新
  const { data: updatedItem, error: updateError } = await supabase
    .from('feedback_generation_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('id', item.id)
    .eq('status', 'pending') // 競合状態を防ぐ
    .select()
    .single();
  
  if (updateError) {
    throw new Error(`Failed to lock queue item: ${updateError.message}`);
  }
  
  if (!updatedItem) {
    // 他のプロセスに取られた
    console.log('Queue item was taken by another process');
    return null;
  }
  
  console.log(`🔒 Locked queue item ${item.id} for user ${item.user_id}`);
  return updatedItem;
}

/**
 * 処理完了としてマーク
 */
export async function markCompleted(queueId: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('feedback_generation_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', queueId);
  
  if (error) {
    throw new Error(`Failed to mark queue item as completed: ${error.message}`);
  }
  
  console.log(`✅ Marked queue item ${queueId} as completed`);
}

/**
 * 処理失敗としてマーク（リトライ可能なら再キュー）
 */
export async function markFailed(queueId: string, errorMessage: string): Promise<boolean> {
  const supabase = createClient();
  
  // 現在のアイテムを取得
  const { data: item, error: selectError } = await supabase
    .from('feedback_generation_queue')
    .select('retry_count, max_retries')
    .eq('id', queueId)
    .single();
  
  if (selectError) {
    throw new Error(`Failed to get queue item for retry: ${selectError.message}`);
  }
  
  const newRetryCount = item.retry_count + 1;
  const shouldRetry = newRetryCount <= item.max_retries;
  
  const { error } = await supabase
    .from('feedback_generation_queue')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      retry_count: newRetryCount,
      error_message: errorMessage,
      started_at: null, // リトライ時はリセット
      completed_at: shouldRetry ? null : new Date().toISOString()
    })
    .eq('id', queueId);
  
  if (error) {
    throw new Error(`Failed to mark queue item as failed: ${error.message}`);
  }
  
  if (shouldRetry) {
    console.log(`🔄 Queue item ${queueId} will be retried (attempt ${newRetryCount})`);
  } else {
    console.log(`❌ Queue item ${queueId} failed permanently after ${newRetryCount} attempts`);
  }
  
  return shouldRetry;
}

/**
 * 一時フィードバックを保存
 */
export async function saveTemporaryFeedback(feedback: Omit<TemporaryFeedback, 'id' | 'generated_at' | 'expires_at' | 'is_displayed'>): Promise<TemporaryFeedback> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('temporary_feedbacks')
    .insert({
      ...feedback,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
      is_displayed: false
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save temporary feedback: ${error.message}`);
  }
  
  console.log(`💾 Saved temporary feedback ${data.id} for user ${feedback.user_id}`);
  return data;
}

/**
 * ユーザーの一時フィードバックを取得
 */
export async function getTemporaryFeedbacks(userId: string, limit: number = 50): Promise<TemporaryFeedback[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('temporary_feedbacks')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to get temporary feedbacks: ${error.message}`);
  }
  
  return data || [];
}

/**
 * 期限切れの一時フィードバックをクリーンアップ
 */
export async function cleanupExpiredFeedbacks(): Promise<number> {
  const supabase = createClient();
  
  const { data, error } = await supabase.rpc('cleanup_expired_temporary_feedbacks');
  
  if (error) {
    throw new Error(`Failed to cleanup expired feedbacks: ${error.message}`);
  }
  
  console.log(`🧹 Cleaned up ${data} expired temporary feedbacks`);
  return data;
}

/**
 * キューの統計情報を取得
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedback_generation_queue')
    .select('status')
    .not('status', 'eq', null);
  
  if (error) {
    throw new Error(`Failed to get queue stats: ${error.message}`);
  }
  
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: data?.length || 0
  };
  
  data?.forEach(item => {
    if (item.status in stats) {
      stats[item.status as keyof typeof stats]++;
    }
  });
  
  return stats;
}