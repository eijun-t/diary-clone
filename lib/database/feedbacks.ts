import { createClient } from '@/lib/supabase/client';
import { Feedback, FeedbackInsert, FeedbackUpdate } from '@/lib/types/database';

export async function createFeedback(feedback: FeedbackInsert): Promise<Feedback | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .insert([feedback])
    .select(`
      *,
      character:characters(*)
    `)
    .single();

  if (error) {
    console.error('Error creating feedback:', error);
    throw error;
  }

  return data;
}

export async function getFeedbacks(userId: string): Promise<Feedback[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedbacks:', error);
    throw error;
  }

  return data || [];
}

export async function getFeedback(id: number, userId: string): Promise<Feedback | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching feedback:', error);
    throw error;
  }

  return data;
}

export async function getFeedbacksByDate(userId: string, date: string): Promise<Feedback[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('user_id', userId)
    .eq('feedback_date', date)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedbacks by date:', error);
    throw error;
  }

  return data || [];
}

export async function getFeedbacksByCharacter(userId: string, characterId: number): Promise<Feedback[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedbacks by character:', error);
    throw error;
  }

  return data || [];
}

export async function getFavoritedFeedbacks(userId: string): Promise<Feedback[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('user_id', userId)
    .eq('is_favorited', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorited feedbacks:', error);
    throw error;
  }

  return data || [];
}

export async function updateFeedback(id: number, userId: string, updates: FeedbackUpdate): Promise<Feedback | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(`
      *,
      character:characters(*)
    `)
    .single();

  if (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }

  return data;
}

export async function toggleFeedbackFavorite(id: number, userId: string): Promise<Feedback | null> {
  const supabase = createClient();
  
  const currentFeedback = await getFeedback(id, userId);
  if (!currentFeedback) {
    throw new Error('Feedback not found');
  }

  const { data, error } = await supabase
    .from('feedbacks')
    .update({ is_favorited: !currentFeedback.is_favorited })
    .eq('id', id)
    .eq('user_id', userId)
    .select(`
      *,
      character:characters(*)
    `)
    .single();

  if (error) {
    console.error('Error toggling feedback favorite:', error);
    throw error;
  }

  return data;
}

export async function deleteFeedback(id: number, userId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('feedbacks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting feedback:', error);
    throw error;
  }

  return true;
}

export async function getFeedbacksGroupedByDate(userId: string): Promise<Record<string, Feedback[]>> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      *,
      character:characters(*)
    `)
    .eq('user_id', userId)
    .order('feedback_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedbacks grouped by date:', error);
    throw error;
  }

  const grouped: Record<string, Feedback[]> = {};
  
  data?.forEach((feedback) => {
    const date = feedback.feedback_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(feedback);
  });

  return grouped;
}