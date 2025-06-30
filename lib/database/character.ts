import { createClient } from '@/lib/supabase/client';
import { 
  Character, 
  Feedback, 
  ChatSession, 
  ChatMessage, 
  FavoriteFeedback 
} from '@/lib/types/character';

const supabase = createClient();

// Character operations
export async function getAllCharacters(): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('is_active', true)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

function mapCharacterFromDb(dbCharacter: any): Character {
  return {
    id: dbCharacter.id.toString(),
    name: dbCharacter.name,
    role: dbCharacter.role,
    personality: dbCharacter.personality,
    speechStyle: dbCharacter.speech_style,
    backgroundColor: dbCharacter.background_color,
    avatarUrl: dbCharacter.avatar_url,
    systemPrompt: dbCharacter.system_prompt || dbCharacter.prompt,
    isActive: dbCharacter.is_active,
    createdAt: new Date(dbCharacter.created_at),
    updatedAt: new Date(dbCharacter.updated_at || dbCharacter.created_at)
  };
}

export async function getCharacterById(id: string): Promise<Character | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return mapCharacterFromDb(data);
}

// Feedback operations
export async function createFeedback(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback> {
  const { data, error } = await supabase
    .from('feedbacks')
    .insert({
      character_id: feedback.characterId,
      user_id: feedback.userId,
      diary_entry_id: feedback.diaryEntryId,
      content: feedback.content,
      generated_at: feedback.generatedAt.toISOString(),
      is_favorited: feedback.isFavorited
    })
    .select()
    .single();

  if (error) throw error;
  return mapFeedbackFromDb(data);
}

export async function getFeedbacksByDiaryEntry(diaryEntryId: number): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      characters (name, role, background_color)
    `)
    .eq('diary_entry_id', diaryEntryId)
    .order('created_at');

  if (error) throw error;
  return data?.map(mapFeedbackFromDb) || [];
}

export async function getFeedbacksByUser(userId: string, limit?: number): Promise<Feedback[]> {
  let query = supabase
    .from('feedbacks')
    .select(`
      *,
      characters (name, role, background_color),
      diaries (content, created_at)
    `)
    .eq('user_id', userId)
    .order('generated_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.map(mapFeedbackFromDb) || [];
}

export async function updateFeedbackFavorite(feedbackId: string, isFavorited: boolean): Promise<void> {
  const { error } = await supabase
    .from('feedbacks')
    .update({ is_favorited: isFavorited })
    .eq('id', feedbackId);

  if (error) throw error;
}

// Chat operations
export async function createChatSession(session: Omit<ChatSession, 'id' | 'createdAt'>): Promise<ChatSession> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: session.userId,
      character_id: session.characterId,
      feedback_id: session.feedbackId,
      title: session.title,
      is_active: session.isActive,
      last_message_at: session.lastMessageAt.toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return mapChatSessionFromDb(data);
}

export async function getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(`
      *,
      characters (name, role, background_color)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data?.map(mapChatSessionFromDb) || [];
}

export async function getChatMessages(chatSessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_session_id', chatSessionId)
    .order('created_at');

  if (error) throw error;
  return data?.map(mapChatMessageFromDb) || [];
}

export async function createChatMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      chat_session_id: message.chatSessionId,
      sender_id: message.senderId,
      sender_type: message.senderType,
      content: message.content
    })
    .select()
    .single();

  if (error) throw error;

  // Update last_message_at in chat session
  await supabase
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', message.chatSessionId);

  return mapChatMessageFromDb(data);
}

// Favorite operations
export async function addFeedbackToFavorites(userId: string, feedbackId: string, note?: string): Promise<FavoriteFeedback> {
  const { data, error } = await supabase
    .from('favorite_feedbacks')
    .insert({
      user_id: userId,
      feedback_id: feedbackId,
      note: note
    })
    .select()
    .single();

  if (error) throw error;
  return mapFavoriteFeedbackFromDb(data);
}

export async function removeFeedbackFromFavorites(userId: string, feedbackId: string): Promise<void> {
  const { error } = await supabase
    .from('favorite_feedbacks')
    .delete()
    .eq('user_id', userId)
    .eq('feedback_id', feedbackId);

  if (error) throw error;
}

export async function getFavoriteFeedbacks(userId: string): Promise<FavoriteFeedback[]> {
  const { data, error } = await supabase
    .from('favorite_feedbacks')
    .select(`
      *,
      feedbacks (
        *,
        characters (name, role, background_color),
        diaries (content, created_at)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map(mapFavoriteFeedbackFromDb) || [];
}

// Utility functions to map database objects to TypeScript interfaces
function mapFeedbackFromDb(data: any): Feedback {
  return {
    id: data.id,
    characterId: data.character_id,
    userId: data.user_id,
    diaryEntryId: data.diary_entry_id,
    content: data.content,
    generatedAt: new Date(data.generated_at),
    isFavorited: data.is_favorited,
    createdAt: new Date(data.created_at)
  };
}

function mapChatSessionFromDb(data: any): ChatSession {
  return {
    id: data.id,
    userId: data.user_id,
    characterId: data.character_id,
    feedbackId: data.feedback_id,
    title: data.title,
    isActive: data.is_active,
    lastMessageAt: new Date(data.last_message_at),
    createdAt: new Date(data.created_at)
  };
}

function mapChatMessageFromDb(data: any): ChatMessage {
  return {
    id: data.id,
    chatSessionId: data.chat_session_id,
    senderId: data.sender_id,
    senderType: data.sender_type,
    content: data.content,
    createdAt: new Date(data.created_at)
  };
}

function mapFavoriteFeedbackFromDb(data: any): FavoriteFeedback {
  return {
    id: data.id,
    userId: data.user_id,
    feedbackId: data.feedback_id,
    note: data.note,
    createdAt: new Date(data.created_at)
  };
}