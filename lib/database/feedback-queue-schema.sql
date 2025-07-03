-- フィードバック生成キューテーブル
CREATE TABLE IF NOT EXISTS feedback_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  INDEX idx_feedback_queue_status_priority ON feedback_generation_queue(status, priority DESC, created_at ASC)
);

-- 一時的なフィードバック保存テーブル（お気に入り登録前）
CREATE TABLE IF NOT EXISTS temporary_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  diary_entry_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  model_used TEXT,
  tokens_used INTEGER,
  is_displayed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  INDEX idx_temp_feedbacks_user_generated ON temporary_feedbacks(user_id, generated_at DESC),
  INDEX idx_temp_feedbacks_expires ON temporary_feedbacks(expires_at)
);

-- RLS (Row Level Security) の設定
ALTER TABLE feedback_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_feedbacks ENABLE ROW LEVEL SECURITY;

-- キューテーブルのRLSポリシー（システム管理用）
CREATE POLICY "System can manage feedback queue" ON feedback_generation_queue
  FOR ALL USING (auth.role() = 'service_role');

-- 一時フィードバックテーブルのRLSポリシー
CREATE POLICY "Users can view own temporary feedbacks" ON temporary_feedbacks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage temporary feedbacks" ON temporary_feedbacks
  FOR ALL USING (auth.role() = 'service_role');

-- クリーンアップ用の関数
CREATE OR REPLACE FUNCTION cleanup_expired_temporary_feedbacks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM temporary_feedbacks 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 毎日のクリーンアップを定期実行（pg_cron拡張が必要）
-- SELECT cron.schedule('cleanup-temp-feedbacks', '0 5 * * *', 'SELECT cleanup_expired_temporary_feedbacks();');