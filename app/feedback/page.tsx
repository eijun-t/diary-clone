'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { Feedback } from '@/lib/types/character';
import { getFeedbacksByUser, updateFeedbackFavorite } from '@/lib/database/character';
import { FeedbackHeader } from '@/components/feedback/FeedbackHeader';
import { FeedbackList } from '@/components/feedback/FeedbackList';

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

export default function FeedbackPage() {
  const [user, setUser] = useState<User | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

        // Load feedbacks with existing table structure
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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (feedbackError) {
          setError(`フィードバック取得エラー: ${feedbackError.message}`);
          return;
        }

        if (!feedbackData || feedbackData.length === 0) {
          setFeedbacks([]);
          return;
        }

        // Get character details separately (no diary relationship in current structure)
        const characterIds = [...new Set(feedbackData.map(f => f.character_id))];

        const charactersResult = await supabase
          .from('characters')
          .select('id, name, role, background_color')
          .in('id', characterIds);

        if (charactersResult.error) {
          setError('キャラクターデータの取得に失敗しました');
          return;
        }

        const charactersMap = new Map(charactersResult.data?.map(c => [c.id, c]) || []);

        const mappedFeedbacks: FeedbackWithDetails[] = feedbackData.map((item: any) => {
          const character = charactersMap.get(item.character_id);
          
          return {
            id: item.id,
            characterId: item.character_id,
            userId: item.user_id,
            diaryEntryId: null, // No diary relationship in current structure
            content: item.content,
            generatedAt: new Date(item.feedback_date + 'T00:00:00Z'), // Convert date to datetime
            isFavorited: item.is_favorited,
            createdAt: new Date(item.created_at),
            character: {
              name: character?.name || 'Unknown',
              role: character?.role || 'Unknown',
              background_color: character?.background_color || '#CCCCCC'
            },
            diary: {
              content: '今日の日記', // Generic placeholder since no diary relationship
              created_at: item.feedback_date
            }
          };
        });

        setFeedbacks(mappedFeedbacks);
      } catch (err) {
        setError(`エラー: ${err}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleToggleFavorite = async (feedbackId: string, currentFavorited: boolean) => {
    try {
      await updateFeedbackFavorite(feedbackId, !currentFavorited);
      
      // Update local state
      setFeedbacks(prevFeedbacks =>
        prevFeedbacks.map(feedback =>
          feedback.id === feedbackId
            ? { ...feedback, isFavorited: !currentFavorited }
            : feedback
        )
      );
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen muute-gradient">
      <div className="container mx-auto max-w-lg p-4">
        <FeedbackHeader />
        <FeedbackList
          feedbacks={feedbacks}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}