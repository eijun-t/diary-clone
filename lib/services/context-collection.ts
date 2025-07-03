import { createClient } from '@/lib/supabase/server';
import { storeRawContext } from '@/lib/database/character-context';
import { ContentType, ContextTimeWindow } from '@/lib/types/context';

/**
 * Context collection functions to gather data from existing tables
 */

export async function collectChatContext(
  userId: string,
  characterId: number,
  timeWindow?: ContextTimeWindow
): Promise<void> {
  const supabase = await createClient();
  
  // Get chat sessions for this user-character pair
  let query = supabase
    .from('chat_sessions')
    .select(`
      id,
      created_at,
      chat_messages (
        content,
        sender_type,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .eq('is_active', true);

  if (timeWindow) {
    query = query
      .gte('created_at', timeWindow.start.toISOString())
      .lt('created_at', timeWindow.end.toISOString());
  }

  const { data: sessions, error } = await query;

  if (error) {
    console.error('Error fetching chat sessions:', error);
    return;
  }

  if (!sessions || sessions.length === 0) {
    return;
  }

  // Process each session and store relevant chat messages
  for (const session of sessions) {
    if (!session.chat_messages || session.chat_messages.length === 0) {
      continue;
    }

    // Combine all messages in the session into context
    const messagesText = session.chat_messages
      .map((msg: any) => `${msg.sender_type === 'user' ? 'User' : 'Character'}: ${msg.content}`)
      .join('\n');

    await storeRawContext(
      userId,
      characterId,
      'chat',
      messagesText,
      {
        session_id: session.id,
        message_count: session.chat_messages.length,
        session_date: session.created_at
      }
    );
  }
}

export async function collectDiaryContext(
  userId: string,
  characterId: number,
  timeWindow?: ContextTimeWindow
): Promise<void> {
  const supabase = await createClient();
  
  let query = supabase
    .from('diaries')
    .select('id, content, mood, created_at')
    .eq('user_id', userId);

  if (timeWindow) {
    query = query
      .gte('created_at', timeWindow.start.toISOString())
      .lt('created_at', timeWindow.end.toISOString());
  }

  const { data: diaries, error } = await query;

  if (error) {
    console.error('Error fetching diary entries:', error);
    return;
  }

  if (!diaries || diaries.length === 0) {
    return;
  }

  // Store each diary entry as context for this character
  for (const diary of diaries) {
    await storeRawContext(
      userId,
      characterId,
      'diary',
      diary.content,
      {
        diary_id: diary.id,
        mood: diary.mood,
        diary_date: diary.created_at
      }
    );
  }
}

export async function collectFeedbackContext(
  userId: string,
  characterId: number,
  timeWindow?: ContextTimeWindow
): Promise<void> {
  const supabase = await createClient();
  
  // Get temporary feedbacks
  let tempQuery = supabase
    .from('temporary_feedbacks')
    .select('id, content, character_id, generated_at, metadata')
    .eq('user_id', userId)
    .eq('character_id', characterId);

  if (timeWindow) {
    tempQuery = tempQuery
      .gte('generated_at', timeWindow.start.toISOString())
      .lt('generated_at', timeWindow.end.toISOString());
  }

  const tempResult = await tempQuery;

  // Get permanent feedbacks
  let permQuery = supabase
    .from('feedbacks')
    .select('id, content, character_id, feedback_date, created_at')
    .eq('user_id', userId)
    .eq('character_id', characterId);

  if (timeWindow) {
    permQuery = permQuery
      .gte('created_at', timeWindow.start.toISOString())
      .lt('created_at', timeWindow.end.toISOString());
  }

  const permResult = await permQuery;

  // Process temporary feedbacks
  if (tempResult.data && tempResult.data.length > 0) {
    for (const tempFeedback of tempResult.data) {
      await storeRawContext(
        userId,
        characterId,
        'feedback',
        tempFeedback.content,
        {
          feedback_id: tempFeedback.id,
          feedback_type: 'temporary',
          generated_at: tempFeedback.generated_at,
          original_metadata: tempFeedback.metadata
        }
      );
    }
  }

  // Process permanent feedbacks
  if (permResult.data && permResult.data.length > 0) {
    for (const permFeedback of permResult.data) {
      await storeRawContext(
        userId,
        characterId,
        'feedback',
        permFeedback.content,
        {
          feedback_id: permFeedback.id,
          feedback_type: 'permanent',
          feedback_date: permFeedback.feedback_date,
          created_at: permFeedback.created_at
        }
      );
    }
  }
}

export async function collectAllContextForCharacter(
  userId: string,
  characterId: number,
  timeWindow?: ContextTimeWindow
): Promise<void> {
  await Promise.all([
    collectChatContext(userId, characterId, timeWindow),
    collectDiaryContext(userId, characterId, timeWindow),
    collectFeedbackContext(userId, characterId, timeWindow)
  ]);
}

export async function collectContextForAllCharacters(
  userId: string,
  timeWindow?: ContextTimeWindow
): Promise<void> {
  // Get all character IDs
  const supabase = await createClient();
  const { data: characters } = await supabase
    .from('characters')
    .select('id');

  if (!characters) {
    return;
  }

  // Collect context for each character
  for (const character of characters) {
    await collectAllContextForCharacter(userId, character.id, timeWindow);
  }
}