'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface SimpleEntry {
  id: number;
  content: string | null;
  mood: string;
  created_at: string;
}

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
  const [entries, setEntries] = useState<SimpleEntry[]>([]);
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

        // Load diary entries using direct Supabase query
        const { data: diaryData, error: diaryError } = await supabase
          .from('diaries')
          .select('id, content, mood, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (diaryError) {
          setError(`日記取得エラー: ${diaryError.message}`);
          return;
        }

        setEntries(diaryData || []);
      } catch (err) {
        setError(`エラー: ${err}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

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
        <div className="text-center py-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">マイダイアリー</h1>
          <p className="text-muted-foreground text-sm mb-6">
            あなたの気持ちの記録
          </p>
          <Button asChild className="muute-button bg-primary hover:bg-primary/90 text-white px-8 py-3">
            <Link href="/diary/new">
              <Plus className="w-4 h-4 mr-2" />
              きろくする
            </Link>
          </Button>
        </div>

        {/* Diary Entries */}
        {entries.length === 0 ? (
          <div className="muute-card p-8 text-center">
            <div className="mb-4">
              <span className="text-6xl">📱</span>
            </div>
            <h3 className="text-lg font-medium mb-2 text-foreground">はじめての記録</h3>
            <p className="text-muted-foreground text-sm mb-6">
              今日の気持ちを書いてみませんか？
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">{entries.length}件の記録</p>
            </div>
            {entries.map((entry) => (
              <div key={entry.id} className="muute-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mood-${entry.mood}`}>
                    {moodEmojis[entry.mood] || '😐'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-1 bg-white/60 rounded-full text-muted-foreground">
                        {moodLabels[entry.mood] || entry.mood}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-foreground text-sm leading-relaxed">
                      {entry.content && entry.content.length > 80 
                        ? entry.content.substring(0, 80) + '...' 
                        : entry.content || '記録'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}