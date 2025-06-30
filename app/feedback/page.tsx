'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Heart, Calendar, ArrowLeft } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { Feedback } from '@/lib/types/character';
import { getFeedbacksByUser, updateFeedbackFavorite } from '@/lib/database/character';

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
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-medium text-foreground">みんなからのメッセージ</h1>
            <p className="text-muted-foreground text-sm">
              キャラクターたちからのフィードバック
            </p>
          </div>
        </div>

        {/* Feedbacks */}
        {feedbacks.length === 0 ? (
          <div className="muute-card p-8 text-center">
            <div className="mb-4">
              <span className="text-6xl">💬</span>
            </div>
            <h3 className="text-lg font-medium mb-2 text-foreground">まだメッセージがありません</h3>
            <p className="text-muted-foreground text-sm mb-6">
              日記を書くと、翌日の朝にキャラクターたちからメッセージが届きます
            </p>
            <Button asChild className="muute-button bg-primary hover:bg-primary/90 text-white">
              <Link href="/diary/new">日記を書く</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <Card
                key={feedback.id}
                className="muute-card border border-border/20 shadow-sm"
                style={{ borderLeftColor: feedback.character.background_color, borderLeftWidth: '4px' }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                        style={{ backgroundColor: feedback.character.background_color }}
                      >
                        {feedback.character.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{feedback.character.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {feedback.character.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFavorite(feedback.id, feedback.isFavorited)}
                        className={`p-2 ${feedback.isFavorited ? 'text-red-500' : 'text-muted-foreground'}`}
                        title="お気に入りに追加"
                      >
                        <Heart className={`w-4 h-4 ${feedback.isFavorited ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Feedback content */}
                    <div className="p-3 bg-white/60 rounded-lg">
                      <p className="text-foreground text-sm leading-relaxed">
                        {feedback.content}
                      </p>
                    </div>
                    
                    {/* Original diary preview */}
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 mb-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(feedback.diary.created_at).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}の日記より
                        </span>
                      </div>
                      <p className="text-xs bg-muted/30 p-2 rounded text-muted-foreground">
                        {feedback.diary.content.length > 60 
                          ? feedback.diary.content.substring(0, 60) + '...'
                          : feedback.diary.content
                        }
                      </p>
                    </div>

                    {/* Chat button */}
                    <div className="pt-3 border-t border-border/20">
                      <Button
                        onClick={() => handleStartChat(feedback.id, feedback.characterId, feedback.character.name)}
                        className="w-full muute-button bg-primary hover:bg-primary/90 text-white"
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {feedback.character.name}とチャットを始める
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}