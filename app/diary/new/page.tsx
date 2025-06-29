'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { createDiaryEntry } from '@/lib/database';
import { MoodType } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User } from '@supabase/supabase-js';

interface DiaryFormData {
  content: string;
  mood?: MoodType;
}

const moodOptions: { value: MoodType; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😊', label: '嬉しい' },
  { value: 'sad', emoji: '😢', label: '悲しい' },
  { value: 'neutral', emoji: '😐', label: '普通' },
  { value: 'excited', emoji: '🤗', label: '興奮' },
  { value: 'angry', emoji: '😠', label: '怒り' },
  { value: 'anxious', emoji: '😰', label: '不安' },
  { value: 'peaceful', emoji: '😌', label: '平和' },
  { value: 'confused', emoji: '😵', label: '混乱' },
];

export default function NewDiaryPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DiaryFormData>();

  const selectedMood = watch('mood');

  // Check authentication
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    }
    getUser();
  }, [router]);

  const onSubmit = async (data: DiaryFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await createDiaryEntry({
        user_id: user.id,
        content: data.content,
        mood: data.mood || 'neutral',
      });

      // Show success message and redirect
      alert('日記が保存されました！');
      router.push('/diary');
    } catch (error) {
      console.error('Error saving diary entry:', error);
      alert('保存中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen muute-gradient">
      <div className="container mx-auto max-w-lg p-4">
        {/* Header Section */}
        <div className="text-center mb-8 pt-6">
          <div className="mb-4">
            <span className="text-4xl">✨</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            気持ちをきろくしよう
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
            今日の出来事や気持ちを<br />
            自由に書いてみてください
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Content Section Card */}
          <Card className="muute-card border border-border/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">📝</span>
                今日はどんな一日でしたか？
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                自由に気持ちを書いてみてください
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                id="content"
                placeholder="今日感じたこと、起こったこと、思ったことを自由に書いてください。どんな小さなことでも大丈夫です..."
                className="min-h-[180px] resize-none text-base leading-relaxed border-2 border-border/40 bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl p-4 shadow-sm"
                {...register('content', {
                  required: '日記の内容を入力してください',
                  minLength: {
                    value: 1,
                    message: '内容を入力してください',
                  },
                })}
              />
              {errors.content && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <span className="text-xs">⚠️</span>
                  {errors.content.message}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Mood Selection Card */}
          <Card className="muute-card border border-border/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">💭</span>
                今の気分はどうですか？
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                あなたの気持ちに一番近い絵文字を選んでください
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto mb-4">
                {moodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (selectedMood === option.value) {
                        setValue('mood', undefined);
                      } else {
                        setValue('mood', option.value);
                      }
                    }}
                    className={`relative w-16 h-16 rounded-2xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center text-2xl shadow-sm hover:shadow-md ${
                      selectedMood === option.value
                        ? 'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/30 scale-105'
                        : 'border-border/40 bg-white hover:border-primary/50 hover:bg-primary/5'
                    }`}
                    title={option.label}
                  >
                    <span className="relative z-10">{option.emoji}</span>
                    {selectedMood === option.value && (
                      <div className="absolute inset-0 bg-primary/5 rounded-2xl"></div>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Mood labels grid */}
              <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto mb-4">
                {moodOptions.map((option) => (
                  <div key={`${option.value}-label`} className="text-center">
                    <span className={`text-xs font-medium ${
                      selectedMood === option.value 
                        ? 'text-primary' 
                        : 'text-muted-foreground'
                    }`}>
                      {option.label}
                    </span>
                  </div>
                ))}
              </div>

              <input
                type="hidden"
                {...register('mood')}
              />
              
            </CardContent>
          </Card>

          {/* Action Buttons Card */}
          <Card className="muute-card border border-border/20 shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      保存中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-lg">💾</span>
                      きろくする
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                  className="w-full py-3 text-sm font-medium border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 rounded-xl transition-all duration-200"
                >
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}