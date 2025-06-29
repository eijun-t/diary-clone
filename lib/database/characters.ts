import { createClient } from '@/lib/supabase/client';
import { Character, CharacterInsert, CharacterUpdate } from '@/lib/types/database';

export async function createCharacter(character: CharacterInsert): Promise<Character | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('characters')
    .insert([character])
    .select()
    .single();

  if (error) {
    console.error('Error creating character:', error);
    throw error;
  }

  return data;
}

export async function getAllCharacters(): Promise<Character[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching characters:', error);
    throw error;
  }

  return data || [];
}

export async function getCharacter(id: number): Promise<Character | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching character:', error);
    throw error;
  }

  return data;
}

export async function getCharacterByName(name: string): Promise<Character | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    console.error('Error fetching character by name:', error);
    throw error;
  }

  return data;
}

export async function updateCharacter(id: number, updates: CharacterUpdate): Promise<Character | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating character:', error);
    throw error;
  }

  return data;
}

export async function deleteCharacter(id: number): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting character:', error);
    throw error;
  }

  return true;
}

export async function getRandomCharacters(count: number = 3): Promise<Character[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('get_random_characters', { count_limit: count });

  if (error) {
    console.error('Error fetching random characters:', error);
    const allCharacters = await getAllCharacters();
    return allCharacters.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  return data || [];
}