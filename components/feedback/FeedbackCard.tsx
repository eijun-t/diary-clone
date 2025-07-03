'use client';

import Link from 'next/link';
import { getCharacterAvatarPath } from '@/lib/utils/character-avatar';

interface FeedbackCardProps {
  feedback: {
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
  };
}

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  // Truncate content to 30 characters
  const previewText = feedback.content.length > 30 
    ? feedback.content.substring(0, 30) + '...' 
    : feedback.content;

  const avatarPath = getCharacterAvatarPath(feedback.character.name);

  return (
    <div className="relative bg-white/80 border border-border/20 rounded-lg p-3 hover:bg-white/90 transition-colors">
      <Link href={`/feedback/${feedback.id}`} className="block">
        <div className="flex items-center gap-3">
          {/* Character Avatar */}
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
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
                    parent.innerHTML = `<span class="text-white text-sm font-bold flex items-center justify-center w-full h-full">${feedback.character.name.charAt(0)}</span>`;
                  }
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: feedback.character.background_color }}
              >
                {feedback.character.name.charAt(0)}
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground text-sm truncate">
                {feedback.character.name}
              </h3>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                {feedback.character.role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {previewText}
            </p>
          </div>
        </div>
      </Link>
      
    </div>
  );
}