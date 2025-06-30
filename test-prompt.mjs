// プロンプト生成のテスト用スクリプト

// Character定義（簡略版）
const CHARACTERS = [
  {
    id: '1',
    name: '鈴木 ハジメ',
    role: 'ライフコーチ',
    personality: '前向きで励ましが得意。自己啓発と成長を重視する。',
    speechStyle: 'です・ます調で丁寧。「〜していきましょう」「素晴らしいですね」など励ましの言葉を多用。',
    backgroundColor: '#90EE90',
    systemPrompt: 'あなたは鈴木ハジメというライフコーチです。',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: '星野 推子',
    role: '推し活女子',
    personality: '感情豊かで共感力が高い。推し活の経験から応援することが得意。',
    speechStyle: '親しみやすい若者言葉。「〜だよね」「めっちゃ」「推せる」など。絵文字も使う。',
    backgroundColor: '#FFB6C1',
    systemPrompt: 'あなたは星野推子という推し活女子です。',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// プロンプト生成関数（簡略版）
function generateFeedbackPrompt(data) {
  const { character, diaryEntry, previousFeedbacks } = data;
  
  const diaryDate = new Date(diaryEntry.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const moodLabels = {
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

  const contextSection = previousFeedbacks && previousFeedbacks.length > 0 
    ? `\n\n【これまでのやり取り】\n過去にあなたが送ったフィードバック：\n${previousFeedbacks.slice(-2).join('\n')}\n` 
    : '';

  const diarySection = `\n\n【今回の日記】
日付: ${diaryDate}
気分: ${moodLabel}
内容: "${diaryEntry.content}"

上記の日記を読んで、${character.name}として心のこもったフィードバックを書いてください。`;

  return systemPrompt + contextSection + diarySection;
}

// テスト実行
const sampleDiary = {
  id: 1,
  content: "今日は友達とカフェでお茶をしました。久しぶりに会えて本当に楽しかったです。仕事のストレスも忘れることができて、心がリフレッシュされました。帰り道に見た夕焼けもとても綺麗で、今日は良い一日でした。",
  mood: "happy",
  created_at: new Date().toISOString()
};

console.log('=== フィードバックプロンプト生成テスト ===\n');

CHARACTERS.forEach((character, index) => {
  console.log(`--- ${character.name}（${character.role}）のプロンプト ---`);
  
  const prompt = generateFeedbackPrompt({
    character,
    diaryEntry: sampleDiary
  });
  
  console.log(prompt);
  console.log(`\n文字数: ${prompt.length}文字\n`);
  console.log('='.repeat(80) + '\n');
});