import { NextRequest, NextResponse } from 'next/server';
import { executeCompleteFeedbackWorkflow, executeBatchFeedbackWorkflow } from '@/lib/utils/feedbackWorkflow';
import { validateGenerationConfig } from '@/lib/utils/feedbackGenerator';
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

    return NextResponse.json({
      success: true,
      message: 'Complete feedback workflow API is ready',
      availableEndpoints: {
        single: 'POST /api/test/complete-feedback-workflow with diaryContent',
        batch: 'POST /api/test/complete-feedback-workflow with diaryEntries array'
      },
      configValidation,
      availableCharacters: CHARACTERS.length
    });

  } catch (error) {
    console.error('Error checking workflow status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check workflow status',
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
      mode = 'single',
      diaryContent,
      diaryEntries,
      mood = 'neutral',
      userId = 'test-user-id',
      characterCount = 3,
      options = {}
    } = body;

    // 設定検証
    const configValidation = validateGenerationConfig();
    if (!configValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Configuration validation failed',
        details: configValidation.errors
      }, { status: 400 });
    }

    const defaultOptions = {
      model: 'gpt-4o',
      maxTokens: 150,
      temperature: 0.8,
      ...options
    };

    const testCharacters = CHARACTERS.slice(0, characterCount);

    if (mode === 'single') {
      // 単一日記エントリのワークフローテスト
      if (!diaryContent) {
        return NextResponse.json({
          error: 'diaryContent is required for single mode'
        }, { status: 400 });
      }

      const testDiary = {
        id: Date.now(),
        content: diaryContent,
        mood: mood,
        created_at: new Date().toISOString()
      };

      console.log(`🚀 Testing complete workflow for single diary entry...`);

      const result = await executeCompleteFeedbackWorkflow(
        testDiary,
        userId,
        testCharacters,
        defaultOptions
      );

      return NextResponse.json({
        success: true,
        mode: 'single',
        result,
        testConfiguration: {
          userId,
          characterCount: testCharacters.length,
          characters: testCharacters.map(c => ({ name: c.name, role: c.role })),
          options: defaultOptions
        }
      });

    } else if (mode === 'batch') {
      // バッチワークフローテスト
      let testDiaryEntries;

      if (diaryEntries && Array.isArray(diaryEntries)) {
        // カスタム日記エントリ
        testDiaryEntries = diaryEntries.map((entry, index) => ({
          id: Date.now() + index,
          content: entry.content || entry,
          mood: entry.mood || 'neutral',
          created_at: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString()
        }));
      } else {
        // デフォルトサンプル日記エントリ
        testDiaryEntries = [
          {
            id: Date.now(),
            content: "今日は友達とカフェでお茶をしました。とても楽しい時間でした。",
            mood: "happy",
            created_at: new Date().toISOString()
          },
          {
            id: Date.now() + 1,
            content: "仕事で疲れたけど、家族と夕食を食べて少し元気になりました。",
            mood: "neutral",
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      }

      console.log(`🔄 Testing batch workflow for ${testDiaryEntries.length} diary entries...`);

      const result = await executeBatchFeedbackWorkflow(
        testDiaryEntries,
        userId,
        testCharacters,
        defaultOptions
      );

      return NextResponse.json({
        success: true,
        mode: 'batch',
        result,
        testConfiguration: {
          userId,
          diaryCount: testDiaryEntries.length,
          characterCount: testCharacters.length,
          characters: testCharacters.map(c => ({ name: c.name, role: c.role })),
          options: defaultOptions
        }
      });

    } else {
      return NextResponse.json({
        error: 'Invalid mode. Use "single" or "batch"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error executing complete feedback workflow:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute complete feedback workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}