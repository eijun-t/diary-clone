'use client';

import { FeedbackCard } from './FeedbackCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FeedbackListProps {
  feedbacks: Array<{
    id: string;
    content: string;
    isFavorited: boolean;
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
  }>;
  isLoading?: boolean;
  emptyStateMessage?: string;
  emptyStateDescription?: string;
}

export function FeedbackList({ 
  feedbacks, 
  isLoading = false,
  emptyStateMessage = "まだメッセージがありません",
  emptyStateDescription = "日記を書くと、翌日の朝にキャラクターたちからメッセージが届きます"
}: FeedbackListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>読み込み中...</div>
      </div>
    );
  }

  if (feedbacks.length === 0) {
    return (
      <div className="muute-card p-8 text-center">
        <div className="mb-4">
          <span className="text-6xl">💬</span>
        </div>
        <h3 className="text-lg font-medium mb-2 text-foreground">{emptyStateMessage}</h3>
        <p className="text-muted-foreground text-sm mb-6">
          {emptyStateDescription}
        </p>
        <Button asChild className="muute-button bg-primary hover:bg-primary/90 text-white">
          <Link href="/diary/new">日記を書く</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="フィードバック一覧">
      {feedbacks.map((feedback) => (
        <div key={feedback.id} role="listitem">
          <FeedbackCard
            feedback={feedback}
          />
        </div>
      ))}
    </div>
  );
}