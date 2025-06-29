'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getDiaryEntriesGroupedByDay } from '@/lib/database';
import { DiaryEntry } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar } from 'lucide-react';
import { User } from '@supabase/supabase-js';

const moodEmojis: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  neutral: '😐',
  excited: '🤗',
  angry: '😠',
  anxious: '😰',
  peaceful: '😌',
  confused: '😵',
};

const moodLabels: Record<string, string> = {
  happy: '嬉しい',
  sad: '悲しい',
  neutral: '普通',
  excited: '興奮',
  angry: '怒り',
  anxious: '不安',
  peaceful: '平和',
  confused: '混乱',
};

export default function DiaryListPage() {
  const [user, setUser] = useState<User | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUser(user);

      try {
        const entries = await getDiaryEntriesGroupedByDay(user.id);
        setDiaryEntries(entries);
      } catch (error) {
        console.error('Error loading diary entries:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const sortedDates = Object.keys(diaryEntries).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="container mx-auto max-w-4xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">日記一覧</h1>
          <p className="text-muted-foreground mt-1">
            あなたの日記 ({Object.values(diaryEntries).flat().length}件)
          </p>
        </div>
        <Button asChild>
          <Link href="/diary/new">
            <Plus className="w-4 h-4 mr-2" />
            新しい日記
          </Link>
        </Button>
      </div>

      {/* Diary Entries */}
      {sortedDates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">まだ日記がありません</h3>
            <p className="text-muted-foreground mb-4">
              最初の日記を書いて、あなたの物語を始めましょう。
            </p>
            <Button asChild>
              <Link href="/diary/new">
                <Plus className="w-4 h-4 mr-2" />
                日記を書く
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{formatDate(date)}</h2>
                <Badge variant="secondary">
                  {diaryEntries[date].length}件
                </Badge>
              </div>
              
              <div className="grid gap-3">
                {diaryEntries[date].map((entry) => (
                  <Card key={entry.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">
                            {moodEmojis[entry.mood] || '😐'}
                          </span>
                          <Badge variant="outline">
                            {moodLabels[entry.mood] || entry.mood}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatTime(entry.created_at)}
                        </span>
                      </div>
                      
                      <div className="max-w-none">
                        <p className="text-foreground leading-relaxed overflow-hidden">
                          {entry.content && entry.content.length > 150 
                            ? entry.content.substring(0, 150) + '...' 
                            : entry.content || '内容なし'}
                        </p>
                      </div>
                      
                      <div className="flex justify-end mt-3">
                        <Button variant="ghost" size="sm">
                          詳細を見る
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}