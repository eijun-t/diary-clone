export type MoodType = 'happy' | 'sad' | 'neutral' | 'excited' | 'angry' | 'anxious' | 'peaceful' | 'confused';

export interface DiaryEntry {
  id: number;
  user_id: string;
  content: string | null;
  mood: MoodType;
  created_at: string;
}

export interface DiaryEntryInsert {
  user_id: string;
  content?: string | null;
  mood: MoodType;
}

export interface DiaryEntryUpdate {
  content?: string | null;
  mood?: MoodType;
}

export interface Character {
  id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  prompt: string;
  created_at: string;
}

export interface CharacterInsert {
  name: string;
  description?: string | null;
  icon_url?: string | null;
  prompt: string;
}

export interface CharacterUpdate {
  name?: string;
  description?: string | null;
  icon_url?: string | null;
  prompt?: string;
}

export interface Feedback {
  id: number;
  user_id: string;
  character_id: number;
  content: string;
  is_favorited: boolean;
  feedback_date: string;
  created_at: string;
}

export interface FeedbackInsert {
  user_id: string;
  character_id: number;
  content: string;
  is_favorited?: boolean;
  feedback_date: string;
}

export interface FeedbackUpdate {
  content?: string;
  is_favorited?: boolean;
  feedback_date?: string;
}