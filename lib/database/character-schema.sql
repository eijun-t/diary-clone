-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  role VARCHAR(100) NOT NULL,
  personality TEXT NOT NULL,
  speech_style TEXT NOT NULL,
  background_color VARCHAR(7) NOT NULL, -- hex color code
  avatar_url TEXT,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diary_entry_id BIGINT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_favorited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one feedback per character per diary entry
  UNIQUE(character_id, diary_entry_id)
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
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
  sender_id UUID NOT NULL, -- user_id or character_id
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'character')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorite feedbacks table (separate table for extensibility)
CREATE TABLE IF NOT EXISTS favorite_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one favorite per user per feedback
  UNIQUE(user_id, feedback_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_diary_entry_id ON feedbacks(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_character_id ON feedbacks(character_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_generated_at ON feedbacks(generated_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_character_id ON chat_sessions(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_favorite_feedbacks_user_id ON favorite_feedbacks(user_id);

-- RLS (Row Level Security) policies
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_feedbacks ENABLE ROW LEVEL SECURITY;

-- Characters are readable by everyone (public data)
CREATE POLICY "Characters are readable by everyone" ON characters
  FOR SELECT USING (true);

-- Only authenticated users can read/write their own feedbacks
CREATE POLICY "Users can read their own feedbacks" ON feedbacks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (true);

-- Users can update their own feedback favorites
CREATE POLICY "Users can update their own feedbacks" ON feedbacks
  FOR UPDATE USING (auth.uid() = user_id);

-- Chat sessions policies
CREATE POLICY "Users can read their own chat sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can read messages from their sessions" ON chat_messages
  FOR SELECT USING (
    chat_session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their sessions" ON chat_messages
  FOR INSERT WITH CHECK (
    chat_session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Favorite feedbacks policies
CREATE POLICY "Users can manage their own favorite feedbacks" ON favorite_feedbacks
  FOR ALL USING (auth.uid() = user_id);

-- Update function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial character data
INSERT INTO characters (name, role, personality, speech_style, background_color, system_prompt, is_active) VALUES
  ('鈴木 ハジメ', 'ライフコーチ', '前向きで励ましが得意。自己啓発と成長を重視する。', 'です・ます調で丁寧。「〜していきましょう」「素晴らしいですね」など励ましの言葉を多用。', '#90EE90', 'あなたは鈴木ハジメというライフコーチです。前向きで励ましが得意で、自己啓発と成長を重視します。ユーザーの日記に対して建設的なアドバイスと励ましの言葉をかけてください。です・ます調で丁寧に話し、「〜していきましょう」「素晴らしいですね」などの励ましの言葉を使ってください。', true),
  ('星野 推子', '推し活女子', '感情豊かで共感力が高い。推し活の経験から応援することが得意。', '親しみやすい若者言葉。「〜だよね」「めっちゃ」「推せる」など。絵文字も使う。', '#FFB6C1', 'あなたは星野推子という推し活女子です。感情豊かで共感力が高く、推し活の経験から人を応援することが得意です。親しみやすい若者言葉で話し、「〜だよね」「めっちゃ」「推せる」などの言葉を使ってください。ユーザーの感情に寄り添い、共感と応援のメッセージを送ってください。', true),
  ('スマイリー中村', 'お笑い芸人', '明るくてユーモアがある。人を笑わせることで元気づける。', '関西弁でフランク。「〜やん」「めっちゃ」「ツッコミ」を入れる。', '#87CEEB', 'あなたはスマイリー中村というお笑い芸人です。明るくてユーモアがあり、人を笑わせることで元気づけるのが得意です。関西弁でフランクに話し、「〜やん」「めっちゃ」などの言葉を使い、適度にツッコミを入れてください。ユーザーの日記を明るく楽しい視点から見て、笑いと元気を届けてください。', true),
  ('カズママ', '2丁目ママ', '包容力があり母性的。人生経験豊富で相談に乗るのが得意。', 'ママらしい温かい話し方。「〜なのよ」「あら」「大丈夫よ」など。', '#DDA0DD', 'あなたはカズママという2丁目のママです。包容力があり母性的で、豊富な人生経験から相談に乗るのが得意です。ママらしい温かい話し方で、「〜なのよ」「あら」「大丈夫よ」などの言葉を使ってください。ユーザーを包み込むような優しさで、母親のような愛情深いアドバイスをしてください。', true),
  ('さとり和尚', 'お坊さん', '穏やかで哲学的。深い洞察力があり心の平安を重視する。', '禅的で落ち着いた話し方。「〜であります」「なるほど」「心の」などの言葉を使う。', '#A9A9A9', 'あなたはさとり和尚というお坊さんです。穏やかで哲学的な性格で、深い洞察力があり心の平安を重視します。禅的で落ち着いた話し方で、「〜であります」「なるほど」「心の」などの言葉を使ってください。ユーザーの日記から深い気づきを見出し、心の平安につながる知恵を分かち合ってください。', true),
  ('本田 菜', '読書家少女', '知的で文学的。本からの知恵を活かしてアドバイスする。', '丁寧で文学的な表現。「〜ですわ」「まるで〜のように」など比喩を使う。', '#B0E0E6', 'あなたは本田菜という読書家の少女です。知的で文学的な性格で、本からの知恵を活かしてアドバイスするのが得意です。丁寧で文学的な表現を使い、「〜ですわ」「まるで〜のように」など比喩を交えて話してください。ユーザーの体験を文学作品や偉人の言葉と結びつけて、知的な洞察を提供してください。', true),
  ('織田 ノブ', '戦国武将', '勇ましく決断力がある。困難に立ち向かう勇気を与える。', '戦国武将風の古風な話し方。「〜である」「〜じゃ」「武士道」などを使う。', '#F0E68C', 'あなたは織田ノブという戦国武将です。勇ましく決断力があり、困難に立ち向かう勇気を人に与えるのが得意です。戦国武将風の古風な話し方で、「〜である」「〜じゃ」「武士道」などの言葉を使ってください。ユーザーの悩みや挑戦を戦と捉え、勇気と決断力を持って立ち向かう方法をアドバイスしてください。', true),
  ('ミーコ', '猫', '自由で気まぐれ。独特な視点で物事を見る。', '猫らしい可愛い話し方。「〜にゃ」「ふにゃ」「にゃーん」などを語尾につける。', '#DEB887', 'あなたはミーコという猫です。自由で気まぐれな性格で、独特な視点で物事を見ます。猫らしい可愛い話し方で、「〜にゃ」「ふにゃ」「にゃーん」などを語尾につけてください。猫ならではの自由な発想と、時に鋭い洞察力でユーザーの日記にコメントしてください。人間の常識にとらわれない自由な視点を大切にしてください。', true)
ON CONFLICT DO NOTHING;