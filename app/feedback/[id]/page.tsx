'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { Feedback } from '@/lib/types/character';
import { updateFeedbackFavorite } from '@/lib/database/character';
import { FeedbackDetail } from '@/components/feedback/FeedbackDetail';

interface FeedbackWithDetails extends Feedback {
  character: {
    name: string;
    role: string;
    background_color: string;
  };
  diary: {
    content: string;
    created_at: string;
  };
}

export default function FeedbackDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<FeedbackWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();

  const feedbackId = params.id as string;

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          setError(`認証エラー: ${authError.message}`);
          return;
        }
        
        if (!user) {
          router.push('/auth/login');
          return;
        }

        setUser(user);

        // Load specific feedback
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('feedbacks')
          .select(`
            id,
            character_id,
            user_id,
            content,
            feedback_date,
            is_favorited,
            created_at
          `)
          .eq('id', feedbackId)
          .eq('user_id', user.id)
          .single();

        if (feedbackError) {
          setError(`フィードバック取得エラー: ${feedbackError.message}`);
          return;
        }

        if (!feedbackData) {
          setError('フィードバックが見つかりませんでした');
          return;
        }

        // Get character details
        const { data: characterData, error: characterError } = await supabase
          .from('characters')
          .select('id, name, role, background_color')
          .eq('id', feedbackData.character_id)
          .single();

        if (characterError) {
          setError('キャラクターデータの取得に失敗しました');
          return;
        }

        const mappedFeedback: FeedbackWithDetails = {
          id: feedbackData.id,
          characterId: feedbackData.character_id,
          userId: feedbackData.user_id,
          diaryEntryId: null,
          content: feedbackData.content,
          generatedAt: new Date(feedbackData.feedback_date + 'T00:00:00Z'),
          isFavorited: feedbackData.is_favorited,
          createdAt: new Date(feedbackData.created_at),
          character: {
            name: characterData?.name || 'Unknown',
            role: characterData?.role || 'Unknown',
            background_color: characterData?.background_color || '#CCCCCC'
          },
          diary: {
            content: '今日の日記',
            created_at: feedbackData.feedback_date
          }
        };

        setFeedback(mappedFeedback);
      } catch (err) {
        setError(`エラー: ${err}`);
      } finally {
        setIsLoading(false);
      }
    }

    if (feedbackId) {
      loadData();
    }
  }, [feedbackId, router]);

  const handleToggleFavorite = async (feedbackId: string, currentFavorited: boolean) => {
    try {
      await updateFeedbackFavorite(feedbackId, !currentFavorited);
      
      // Update local state
      if (feedback) {
        setFeedback({
          ...feedback,
          isFavorited: !currentFavorited
        });
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const handleStartChat = (feedbackId: string, characterId: string, characterName: string) => {
    router.push(`/chat?feedbackId=${feedbackId}&characterId=${characterId}&characterName=${encodeURIComponent(characterName)}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!user || !feedback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>フィードバックが見つかりませんでした</div>
      </div>
    );
  }

  return (
    <FeedbackDetail
      feedback={feedback}
      onToggleFavorite={handleToggleFavorite}
      onStartChat={handleStartChat}
    />
  );
}