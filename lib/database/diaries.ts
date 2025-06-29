import { createClient } from '@/lib/supabase/client';
import { DiaryEntry, DiaryEntryInsert, DiaryEntryUpdate } from '@/lib/types/database';

export async function createDiaryEntry(entry: DiaryEntryInsert): Promise<DiaryEntry | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('diaries')
    .insert([entry])
    .select()
    .single();

  if (error) {
    console.error('Error creating diary entry:', error);
    throw error;
  }

  return data;
}

export async function getDiaryEntries(userId: string): Promise<DiaryEntry[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching diary entries:', error);
    throw error;
  }

  return data || [];
}

export async function getDiaryEntry(id: number, userId: string): Promise<DiaryEntry | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching diary entry:', error);
    throw error;
  }

  return data;
}

export async function getDiaryEntriesByDate(userId: string, date: string): Promise<DiaryEntry[]> {
  const supabase = createClient();
  
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching diary entries by date:', error);
    throw error;
  }

  return data || [];
}

export async function updateDiaryEntry(id: number, userId: string, updates: DiaryEntryUpdate): Promise<DiaryEntry | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('diaries')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating diary entry:', error);
    throw error;
  }

  return data;
}

export async function deleteDiaryEntry(id: number, userId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('diaries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting diary entry:', error);
    throw error;
  }

  return true;
}

export async function getDiaryEntriesGroupedByDay(userId: string, limit?: number): Promise<Record<string, DiaryEntry[]>> {
  const supabase = createClient();
  
  let query = supabase
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching diary entries:', error);
    throw error;
  }

  const grouped: Record<string, DiaryEntry[]> = {};
  
  data?.forEach((entry) => {
    const date = new Date(entry.created_at).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  });

  return grouped;
}