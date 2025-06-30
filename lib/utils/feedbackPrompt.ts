import { Character } from '@/lib/types/character';

export interface DiaryEntry {
  id: number;
  content: string;
  mood: string;
  created_at: string;
}

export interface FeedbackPromptData {
  character: Character;
  diaryEntry: DiaryEntry;
  previousFeedbacks?: string[]; // Optional: Previous feedback from this character for context
}

/**
 * 日記フィードバック専用のプロンプトテンプレート生成関数
 * チャット用とは異なり、日記の内容に対する包括的なフィードバックを生成
 */
export function generateFeedbackPrompt(data: FeedbackPromptData): string {
  const { character, diaryEntry, previousFeedbacks } = data;
  
  // 日記の日付を日本語形式で取得
  const diaryDate = new Date(diaryEntry.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // 気分の日本語ラベル
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

  const moodLabel = moodLabels[diaryEntry.mood] || diaryEntry.mood;

  // 基本システムプロンプト
  const systemPrompt = `あなたは${character.name}という${character.role}です。

【あなたの特徴】
${character.personality}

【話し方】
${character.speechStyle}

【フィードバックの目的】
ユーザーが書いた日記に対して、あなたの個性を活かした温かいフィードバックを提供してください。
ただの感想ではなく、ユーザーの気持ちに寄り添い、次の日への活力を与えるようなメッセージを心がけてください。

【フィードバックのガイドライン】
1. 日記の内容を丁寧に読み、ユーザーの感情や体験を理解する
2. あなたの個性（${character.role}として）を活かした独自の視点でコメント
3. ユーザーの選んだ気分（${moodLabel}）を考慮したトーン
4. 100-150文字程度で簡潔にまとめる
5. 押し付けがましくなく、自然で親しみやすい表現
6. ユーザーの体験を否定せず、共感や肯定的な視点を含める`;

  // 過去のフィードバック文脈（もしあれば）
  const contextSection = previousFeedbacks && previousFeedbacks.length > 0 
    ? `\n\n【これまでのやり取り】\n過去にあなたが送ったフィードバック：\n${previousFeedbacks.slice(-2).join('\n')}\n` 
    : '';

  // 日記内容セクション
  const diarySection = `\n\n【今回の日記】
日付: ${diaryDate}
気分: ${moodLabel}
内容: "${diaryEntry.content}"

上記の日記を読んで、${character.name}として心のこもったフィードバックを書いてください。`;

  return systemPrompt + contextSection + diarySection;
}

/**
 * 複数のキャラクターのフィードバックプロンプトを一括生成
 */
export function generateMultiplePrompts(
  characters: Character[],
  diaryEntry: DiaryEntry,
  previousFeedbacksMap?: Map<string, string[]>
): Array<{ character: Character; prompt: string }> {
  return characters.map(character => ({
    character,
    prompt: generateFeedbackPrompt({
      character,
      diaryEntry,
      previousFeedbacks: previousFeedbacksMap?.get(character.id)
    })
  }));
}

/**
 * プロンプトの品質チェック
 */
export function validatePrompt(prompt: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (prompt.length < 100) {
    errors.push('プロンプトが短すぎます');
  }
  
  if (prompt.length > 2000) {
    errors.push('プロンプトが長すぎます');
  }
  
  if (!prompt.includes('日記')) {
    errors.push('日記に関する言及がありません');
  }
  
  if (!prompt.includes('フィードバック')) {
    errors.push('フィードバックの指示がありません');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * デバッグ用：プロンプトの構造を分析
 */
export function analyzePrompt(prompt: string) {
  return {
    length: prompt.length,
    sections: prompt.split('\n\n').length,
    hasCharacterInfo: prompt.includes('あなたは'),
    hasGuidelines: prompt.includes('ガイドライン'),
    hasDiaryContent: prompt.includes('今回の日記'),
    hasContext: prompt.includes('これまでのやり取り')
  };
}