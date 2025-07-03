import { createClient } from '@/lib/supabase/server';
import { CharacterContextRaw, CharacterContextSummary, ContentType, ContextTimeWindow } from '@/lib/types/context';

/**
 * Context collection and storage functions
 */

export async function storeRawContext(
  userId: string,
  characterId: number,
  contentType: ContentType,
  content: string,
  metadata: Record<string, any> = {}
): Promise<CharacterContextRaw | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('character_context_raw')
    .insert({
      user_id: userId,
      character_id: characterId,
      content_type: contentType,
      content,
      metadata
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing raw context:', error);
    return null;
  }

  return data;
}

export async function getRawContextForPeriod(
  userId: string,
  characterId: number,
  timeWindow: ContextTimeWindow
): Promise<CharacterContextRaw[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('character_context_raw')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .gte('created_at', timeWindow.start.toISOString())
    .lt('created_at', timeWindow.end.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching raw context:', error);
    return [];
  }

  return data || [];
}

export async function getRecentRawContext(
  userId: string,
  characterId: number,
  limitDays: number = 7
): Promise<CharacterContextRaw[]> {
  const supabase = await createClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - limitDays);

  const { data, error } = await supabase
    .from('character_context_raw')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching recent raw context:', error);
    return [];
  }

  return data || [];
}

export async function cleanupOldRawContext(olderThanDays: number = 7): Promise<number> {
  const supabase = await createClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { error, count } = await supabase
    .from('character_context_raw')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error cleaning up old raw context:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Summary storage and retrieval functions
 */

export async function storeSummary(
  userId: string,
  characterId: number,
  summaryType: 'weekly' | 'super_weekly',
  periodStart: Date,
  periodEnd: Date,
  summaryContent: string,
  sourceCount: number
): Promise<CharacterContextSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('character_context_summaries')
    .insert({
      user_id: userId,
      character_id: characterId,
      summary_type: summaryType,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      summary_content: summaryContent,
      source_count: sourceCount
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing summary:', error);
    return null;
  }

  return data;
}

export async function getSummariesByType(
  userId: string,
  characterId: number,
  summaryType: 'weekly' | 'super_weekly'
): Promise<CharacterContextSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('character_context_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .eq('summary_type', summaryType)
    .order('period_start', { ascending: true });

  if (error) {
    console.error('Error fetching summaries:', error);
    return [];
  }

  return data || [];
}

export async function getRecentSummaries(
  userId: string,
  characterId: number,
  limit: number = 10
): Promise<CharacterContextSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('character_context_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .order('period_start', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent summaries:', error);
    return [];
  }

  return data || [];
}