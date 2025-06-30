import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check if characters table exists and has data
    const { data: characters, error: charError } = await supabase
      .from('characters')
      .select('id, name')
      .limit(3);

    if (charError) {
      return NextResponse.json({ 
        error: 'Characters table not found. Please run the schema SQL first.',
        details: charError.message 
      }, { status: 400 });
    }

    if (!characters || characters.length === 0) {
      return NextResponse.json({ 
        error: 'No characters found. Please run the schema SQL first.' 
      }, { status: 400 });
    }

    // Get a recent diary entry (without user filter for testing)
    const { data: diaries, error: diaryError } = await supabase
      .from('diaries')
      .select('id, content, user_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (diaryError || !diaries || diaries.length === 0) {
      return NextResponse.json({ 
        error: 'No diary entries found. Please create a diary entry first.',
        debug: { diaryError, diaryCount: diaries?.length || 0 }
      }, { status: 400 });
    }

    const diary = diaries[0];

    // Create sample feedbacks using existing table structure
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const sampleFeedbacks = [
      {
        character_id: characters[0].id, // 鈴木 ハジメ (ライフコーチ)
        user_id: diary.user_id,
        content: `お疲れ様です！今日のお茶の時間、とても素晴らしい選択ですね。こうした小さな幸せを大切にする心が、豊かな人生を作っていきます。これからも自分らしいペースで、充実した日々を過ごしていきましょう！`,
        feedback_date: today,
        is_favorited: false
      },
      {
        character_id: characters[1]?.id, // 星野 推子 (推し活女子)
        user_id: diary.user_id,
        content: `お茶の時間めっちゃ良いじゃん！😊 そういう自分だけの癒し時間、すごく大事だよね〜。推し活してる時みたいに、好きなことに集中する時間って心がほっこりする💕 今度はどんなお茶飲んだか教えて！`,
        feedback_date: today,
        is_favorited: false
      },
      {
        character_id: characters[2]?.id, // スマイリー中村 (お笑い芸人)
        user_id: diary.user_id,
        content: `お茶かいな〜！めっちゃええやん！ワイも今度一緒にお茶しよか？って、まあワイはキャラクターやから実際には無理やけどな〜（笑）でもホンマ、そういうゆったりした時間って大事やで！心の栄養やな！`,
        feedback_date: today,
        is_favorited: false
      }
    ].filter(f => f.character_id); // Filter out entries with undefined character_id

    const { data: insertedFeedbacks, error: insertError } = await supabase
      .from('feedbacks')
      .insert(sampleFeedbacks)
      .select();

    if (insertError) {
      return NextResponse.json({ 
        error: 'Failed to create sample feedbacks',
        details: insertError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `Created ${insertedFeedbacks?.length || 0} sample feedbacks`,
      feedbacks: insertedFeedbacks
    });

  } catch (error) {
    console.error('Error creating sample feedback:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}