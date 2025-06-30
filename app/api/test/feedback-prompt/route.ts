import { NextRequest, NextResponse } from 'next/server';
import { generateFeedbackPrompt, generateMultiplePrompts, validatePrompt, analyzePrompt } from '@/lib/utils/feedbackPrompt';
import { CHARACTERS } from '@/lib/types/character';

export async function GET(request: NextRequest) {
  try {
    // Development only - skip auth for testing
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }
    // サンプル日記エントリ
    const sampleDiary = {
      id: 1,
      content: "今日は友達とカフェでお茶をしました。久しぶりに会えて本当に楽しかったです。仕事のストレスも忘れることができて、心がリフレッシュされました。帰り道に見た夕焼けもとても綺麗で、今日は良い一日でした。",
      mood: "happy",
      created_at: new Date().toISOString()
    };

    // 過去のフィードバック例（オプション）
    const samplePreviousFeedbacks = [
      "お疲れ様でした！友達との時間を大切にする姿勢、とても素晴らしいですね。",
      "ストレス発散は大切です。そういう時間を意識的に作っていきましょう！"
    ];

    // 1. 単一キャラクターのプロンプト生成テスト
    const singleCharacterPrompt = generateFeedbackPrompt({
      character: CHARACTERS[0], // 鈴木ハジメ
      diaryEntry: sampleDiary,
      previousFeedbacks: samplePreviousFeedbacks
    });

    // 2. 複数キャラクターのプロンプト生成テスト
    const multiplePrompts = generateMultiplePrompts(
      CHARACTERS.slice(0, 3), // 最初の3キャラクター
      sampleDiary
    );

    // 3. プロンプト品質チェック
    const validation = validatePrompt(singleCharacterPrompt);

    // 4. プロンプト分析
    const analysis = analyzePrompt(singleCharacterPrompt);

    return NextResponse.json({
      success: true,
      tests: {
        singleCharacterPrompt: {
          character: CHARACTERS[0].name,
          prompt: singleCharacterPrompt,
          validation,
          analysis
        },
        multiplePrompts: multiplePrompts.map(({ character, prompt }) => ({
          characterName: character.name,
          promptLength: prompt.length,
          isValid: validatePrompt(prompt).isValid
        })),
        summary: {
          totalCharactersTested: multiplePrompts.length,
          allPromptsValid: multiplePrompts.every(({ prompt }) => validatePrompt(prompt).isValid),
          averagePromptLength: Math.round(
            multiplePrompts.reduce((sum, { prompt }) => sum + prompt.length, 0) / multiplePrompts.length
          )
        }
      }
    });

  } catch (error) {
    console.error('Error testing feedback prompt:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test feedback prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST エンドポイント：カスタム日記でのテスト
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { diaryContent, mood, characterIds } = body;

    // 入力検証
    if (!diaryContent || !mood) {
      return NextResponse.json({
        error: 'diaryContent and mood are required'
      }, { status: 400 });
    }

    // カスタム日記エントリ作成
    const customDiary = {
      id: Date.now(),
      content: diaryContent,
      mood: mood,
      created_at: new Date().toISOString()
    };

    // 指定されたキャラクターまたは全キャラクター
    const targetCharacters = characterIds 
      ? CHARACTERS.filter(char => characterIds.includes(char.name))
      : CHARACTERS.slice(0, 3);

    // プロンプト生成
    const prompts = generateMultiplePrompts(targetCharacters, customDiary);

    return NextResponse.json({
      success: true,
      diary: customDiary,
      prompts: prompts.map(({ character, prompt }) => ({
        characterName: character.name,
        characterRole: character.role,
        prompt,
        validation: validatePrompt(prompt),
        analysis: analyzePrompt(prompt)
      }))
    });

  } catch (error) {
    console.error('Error generating custom feedback prompt:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate custom feedback prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}