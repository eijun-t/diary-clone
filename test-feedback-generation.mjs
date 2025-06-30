import OpenAI from 'openai';

// Environment check
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Character definition (simplified)
const testCharacter = {
  id: '1',
  name: '鈴木 ハジメ',
  role: 'ライフコーチ',
  personality: '前向きで励ましが得意。自己啓発と成長を重視する。',
  speechStyle: 'です・ます調で丁寧。「〜していきましょう」「素晴らしいですね」など励ましの言葉を多用。'
};

// Sample diary
const testDiary = {
  id: 1,
  content: "今日は友達とカフェでお茶をしました。久しぶりに会えて本当に楽しかったです。仕事のストレスも忘れることができて、心がリフレッシュされました。帰り道に見た夕焼けもとても綺麗で、今日は良い一日でした。",
  mood: "happy",
  created_at: new Date().toISOString()
};

// Generate prompt (simplified version)
function generatePrompt(character, diary) {
  const diaryDate = new Date(diary.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return `あなたは${character.name}という${character.role}です。

【あなたの特徴】
${character.personality}

【話し方】
${character.speechStyle}

【フィードバックの目的】
ユーザーが書いた日記に対して、あなたの個性を活かした温かいフィードバックを提供してください。
100-150文字程度で簡潔にまとめてください。

【今回の日記】
日付: ${diaryDate}
気分: 嬉しい
内容: "${diary.content}"

上記の日記を読んで、${character.name}として心のこもったフィードバックを書いてください。`;
}

async function testFeedbackGeneration() {
  try {
    console.log('=== OpenAI フィードバック生成テスト ===\n');
    console.log(`📝 テスト日記: "${testDiary.content.substring(0, 50)}..."`);
    console.log(`👤 テストキャラクター: ${testCharacter.name} (${testCharacter.role})\n`);

    const prompt = generatePrompt(testCharacter, testDiary);
    console.log('📋 生成されたプロンプト:');
    console.log(`文字数: ${prompt.length}文字\n`);

    console.log('🔄 OpenAI API を呼び出し中...\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    const feedback = completion.choices[0]?.message?.content?.trim();

    if (!feedback) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('✅ フィードバック生成成功!\n');
    console.log('=' * 50);
    console.log(`👨‍💼 ${testCharacter.name}からのフィードバック:`);
    console.log('=' * 50);
    console.log(feedback);
    console.log('=' * 50);
    console.log(`\n📊 統計:`);
    console.log(`- フィードバック文字数: ${feedback.length}文字`);
    console.log(`- 使用トークン: ${completion.usage?.total_tokens || 'N/A'}`);
    console.log(`- 使用モデル: ${completion.model}`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

testFeedbackGeneration();