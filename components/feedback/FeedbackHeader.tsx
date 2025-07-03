'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface FeedbackHeaderProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  showTabs?: boolean;
}

export function FeedbackHeader({ 
  title = "みんなからのメッセージ",
  description = "キャラクターたちからのフィードバック",
  showBackButton = true,
  showTabs = true
}: FeedbackHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isAllFeedbackActive = pathname === '/feedback';
  const isFavoritesActive = pathname === '/feedback/favorites';

  return (
    <div className="mb-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-medium text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className="flex border-b border-border/20">
          <Link 
            href="/feedback"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              isAllFeedbackActive 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            すべてのメッセージ
          </Link>
          <Link 
            href="/feedback/favorites"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              isFavoritesActive 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            お気に入り
          </Link>
        </div>
      )}
    </div>
  );
}