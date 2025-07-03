'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Heart, Calendar, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCharacterAvatarPath } from '@/lib/utils/character-avatar';

interface FeedbackDetailProps {
  feedback: {
    id: string;
    content: string;
    isFavorited: boolean;
    generatedAt: Date;
    createdAt: Date;
    character: {
      name: string;
      role: string;
      background_color: string;
    };
    diary: {
      content: string;
      created_at: string;
    };
    characterId: string;
  };
  onToggleFavorite: (feedbackId: string, currentFavorited: boolean) => void;
  onStartChat: (feedbackId: string, characterId: string, characterName: string) => void;
}

export function FeedbackDetail({ feedback, onToggleFavorite, onStartChat }: FeedbackDetailProps) {
  const router = useRouter();
  const avatarPath = getCharacterAvatarPath(feedback.character.name);

  return (
    <div className="min-h-screen muute-gradient">
      <div className="container mx-auto max-w-2xl p-4">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Main content */}
        <Card className="muute-card border border-border/20 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                  {avatarPath ? (
                    <img
                      src={avatarPath}
                      alt={feedback.character.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to text avatar if image fails to load
                        const target = e.target as HTMLImageElement;
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.backgroundColor = feedback.character.background_color;
                          parent.innerHTML = `<span class="text-white text-xl font-bold flex items-center justify-center w-full h-full">${feedback.character.name.charAt(0)}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: feedback.character.background_color }}
                    >
                      {feedback.character.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">{feedback.character.name}</CardTitle>
                  <Badge variant="secondary" className="text-sm mt-1">
                    {feedback.character.role}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(feedback.id, feedback.isFavorited)}
                  className={`p-3 ${feedback.isFavorited ? 'text-red-500' : 'text-muted-foreground'}`}
                  title={feedback.isFavorited ? 'お気に入りから削除' : 'お気に入りに追加'}
                >
                  <Heart className={`w-5 h-5 ${feedback.isFavorited ? 'fill-current' : ''}`} />
                </Button>
                <span className="text-xs text-muted-foreground">お気に入り</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Feedback content */}
            <div className="p-4 bg-white/60 rounded-lg">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {feedback.content}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border/20">
              <Button
                onClick={() => onStartChat(feedback.id, feedback.characterId, feedback.character.name)}
                className="w-full muute-button bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {feedback.character.name}とチャットを始める
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}