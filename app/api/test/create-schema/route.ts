import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check characters table structure first
    const { data: charColumns, error: charError } = await supabase
      .rpc('get_table_columns', { table_name: 'characters' })
      .then(result => ({ data: null, error: result.error }))
      .catch(() => ({ data: null, error: null }));

    // Try to get character ID type by querying the table
    const { data: charSample, error: charSampleError } = await supabase
      .from('characters')
      .select('id')
      .limit(1);

    let characterIdType = 'bigint'; // Default assumption based on error
    if (!charSampleError && charSample && charSample.length > 0) {
      const sampleId = charSample[0].id;
      characterIdType = typeof sampleId === 'string' ? 'uuid' : 'bigint';
    }

    // Check if required tables exist
    const requiredTables = ['characters', 'chat_sessions', 'chat_messages'];
    const missingTables: string[] = [];
    
    for (const tableName of requiredTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') { // Table doesn't exist
        missingTables.push(tableName);
      }
    }
    
    if (missingTables.length > 0) {
      return NextResponse.json({ 
        error: `Required tables missing: ${missingTables.join(', ')}`,
        message: `Please run the following SQL in your Supabase dashboard:

-- Chat sessions table (compatible with ${characterIdType} character IDs)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id ${characterIdType} NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES feedbacks(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'character')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for development
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;`,
        missing_tables: missingTables,
        character_id_type: characterIdType
      }, { status: 400 });
    }

    // Insert sample characters using existing table structure
    const characters = [
      {
        name: '鈴木 ハジメ',
        role: 'ライフコーチ',
        description: '前向きで励ましが得意。自己啓発と成長を重視する。',
        personality: '前向きで励ましが得意。自己啓発と成長を重視する。',
        speech_style: 'です・ます調で丁寧。「〜していきましょう」「素晴らしいですね」など励ましの言葉を多用。',
        background_color: '#90EE90',
        icon_url: null,
        avatar_url: null,
        prompt: 'あなたは鈴木ハジメというライフコーチです。前向きで励ましが得意で、自己啓発と成長を重視します。ユーザーの日記に対して建設的なアドバイスと励ましの言葉をかけてください。です・ます調で丁寧に話し、「〜していきましょう」「素晴らしいですね」などの励ましの言葉を使ってください。',
        system_prompt: 'あなたは鈴木ハジメというライフコーチです。前向きで励ましが得意で、自己啓発と成長を重視します。ユーザーの日記に対して建設的なアドバイスと励ましの言葉をかけてください。です・ます調で丁寧に話し、「〜していきましょう」「素晴らしいですね」などの励ましの言葉を使ってください。',
        is_active: true
      },
      {
        name: '星野 推子',
        role: '推し活女子',
        description: '感情豊かで共感力が高い。推し活の経験から応援することが得意。',
        personality: '感情豊かで共感力が高い。推し活の経験から応援することが得意。',
        speech_style: '親しみやすい若者言葉。「〜だよね」「めっちゃ」「推せる」など。絵文字も使う。',
        background_color: '#FFB6C1',
        icon_url: null,
        avatar_url: null,
        prompt: 'あなたは星野推子という推し活女子です。感情豊かで共感力が高く、推し活の経験から人を応援することが得意です。親しみやすい若者言葉で話し、「〜だよね」「めっちゃ」「推せる」などの言葉を使ってください。ユーザーの感情に寄り添い、共感と応援のメッセージを送ってください。',
        system_prompt: 'あなたは星野推子という推し活女子です。感情豊かで共感力が高く、推し活の経験から人を応援することが得意です。親しみやすい若者言葉で話し、「〜だよね」「めっちゃ」「推せる」などの言葉を使ってください。ユーザーの感情に寄り添い、共感と応援のメッセージを送ってください。',
        is_active: true
      },
      {
        name: 'スマイリー中村',
        role: 'お笑い芸人',
        description: '明るくてユーモアがある。人を笑わせることで元気づける。',
        personality: '明るくてユーモアがある。人を笑わせることで元気づける。',
        speech_style: '関西弁でフランク。「〜やん」「めっちゃ」「ツッコミ」を入れる。',
        background_color: '#87CEEB',
        icon_url: null,
        avatar_url: null,
        prompt: 'あなたはスマイリー中村というお笑い芸人です。明るくてユーモアがあり、人を笑わせることで元気づけるのが得意です。関西弁でフランクに話し、「〜やん」「めっちゃ」などの言葉を使い、適度にツッコミを入れてください。ユーザーの日記を明るく楽しい視点から見て、笑いと元気を届けてください。',
        system_prompt: 'あなたはスマイリー中村というお笑い芸人です。明るくてユーモアがあり、人を笑わせることで元気づけるのが得意です。関西弁でフランクに話し、「〜やん」「めっちゃ」などの言葉を使い、適度にツッコミを入れてください。ユーザーの日記を明るく楽しい視点から見て、笑いと元気を届けてください。',
        is_active: true
      }
    ];

    // Try to insert characters
    const { data: insertedChars, error: insertError } = await supabase
      .from('characters')
      .upsert(characters)
      .select();

    if (insertError) {
      return NextResponse.json({ 
        error: 'Failed to insert characters. Tables may not exist.',
        details: insertError.message,
        suggestion: 'Please create tables manually in Supabase dashboard using the SQL from character-schema.sql'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Schema created successfully with initial character data'
    });

  } catch (error) {
    console.error('Error creating schema:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}