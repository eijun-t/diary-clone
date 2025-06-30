import { NextRequest, NextResponse } from 'next/server';
import { generateCharacterFeedback, generateDailyFeedbacks, validateGenerationConfig } from '@/lib/utils/feedbackGenerator';
import { CHARACTERS } from '@/lib/types/character';

export async function GET(request: NextRequest) {
  try {
    // Development only
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    // 設定検証
    const configValidation = validateGenerationConfig();
    if (!configValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Configuration validation failed',
        details: configValidation.errors
      }, { status: 400 });
    }

    // サンプル日記エントリ
    const sampleDiary = {
      id: 1,
      content: "今日は友達とカフェでお茶をしました。久しぶりに会えて本当に楽しかったです。仕事のストレスも忘れることができて、心がリフレッシュされました。帰り道に見た夕焼けもとても綺麗で、今日は良い一日でした。",
      mood: "happy",
      created_at: new Date().toISOString()
    };

    // 単一キャラクターテスト（鈴木ハジメ）
    console.log('Testing single character feedback generation...');
    const singleResult = await generateCharacterFeedback(
      CHARACTERS[0], 
      sampleDiary,
      { 
        model: 'gpt-4o',
        maxTokens: 150,
        temperature: 0.8 
      }
    );

    return NextResponse.json({
      success: true,
      configValidation,
      sampleDiary,
      singleCharacterTest: {
        character: CHARACTERS[0].name,
        result: singleResult
      },
      note: 'Use POST method with custom diary content for full testing'
    });

  } catch (error) {
    console.error('Error testing feedback generation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test feedback generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Development only
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      diaryContent, 
      mood = 'neutral', 
      testMode = 'single',
      characterCount = 3,
      options = {}
    } = body;

    if (!diaryContent) {
      return NextResponse.json({
        error: 'diaryContent is required'
      }, { status: 400 });
    }

    // 設定検証
    const configValidation = validateGenerationConfig();
    if (!configValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Configuration validation failed',
        details: configValidation.errors
      }, { status: 400 });
    }

    // カスタム日記エントリ作成
    const customDiary = {
      id: Date.now(),
      content: diaryContent,
      mood: mood,
      created_at: new Date().toISOString()
    };

    const generationOptions = {
      model: 'gpt-4o',
      maxTokens: 150,
      temperature: 0.8,
      ...options
    };

    if (testMode === 'single') {
      // 単一キャラクターテスト
      const character = CHARACTERS[0];
      const result = await generateCharacterFeedback(character, customDiary, generationOptions);
      
      return NextResponse.json({
        success: true,
        mode: 'single',
        diary: customDiary,
        character: character.name,
        result,
        options: generationOptions
      });

    } else if (testMode === 'multiple') {
      // 複数キャラクターテスト
      const testCharacters = CHARACTERS.slice(0, characterCount);
      const results = await generateDailyFeedbacks(customDiary, testCharacters, generationOptions);
      
      return NextResponse.json({
        success: true,
        mode: 'multiple',
        diary: customDiary,
        characterCount: testCharacters.length,
        results,
        options: generationOptions
      });

    } else {
      return NextResponse.json({
        error: 'Invalid testMode. Use "single" or "multiple"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error generating custom feedback:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate custom feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}