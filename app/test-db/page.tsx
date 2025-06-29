'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAllCharacters, createDiaryEntry, getDiaryEntries } from '@/lib/database';
import { Character, DiaryEntry } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from '@supabase/supabase-js';

export default function DatabaseTestPage() {
  const [user, setUser] = useState<User | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    }
    getUser();
  }, []);

  const testCharacters = async () => {
    setTesting(true);
    try {
      const chars = await getAllCharacters();
      setCharacters(chars);
      console.log('Characters fetched:', chars);
    } catch (error) {
      console.error('Error testing characters:', error);
    }
    setTesting(false);
  };

  const testDiaryCreate = async () => {
    if (!user) return;
    
    setTesting(true);
    try {
      const newEntry = await createDiaryEntry({
        user_id: user.id,
        content: `Test diary entry created at ${new Date().toISOString()}`,
        mood: 'happy'
      });
      console.log('Diary entry created:', newEntry);
      
      const entries = await getDiaryEntries(user.id);
      setDiaries(entries);
    } catch (error) {
      console.error('Error testing diary creation:', error);
    }
    setTesting(false);
  };

  const loadDiaries = async () => {
    if (!user) return;
    
    setTesting(true);
    try {
      const entries = await getDiaryEntries(user.id);
      setDiaries(entries);
      console.log('Diary entries fetched:', entries);
    } catch (error) {
      console.error('Error loading diaries:', error);
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Database Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to test database operations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Test Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p>User: {user.email}</p>
          <p>User ID: {user.id}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Characters Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testCharacters} disabled={testing}>
            {testing ? 'Loading...' : 'Load Characters'}
          </Button>
          
          {characters.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Characters ({characters.length}):</h3>
              <ul className="space-y-1">
                {characters.map((char) => (
                  <li key={char.id} className="text-sm">
                    {char.id}: {char.name} - {char.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diary Entries Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={testDiaryCreate} disabled={testing}>
              {testing ? 'Creating...' : 'Create Test Entry'}
            </Button>
            <Button onClick={loadDiaries} disabled={testing} variant="outline">
              {testing ? 'Loading...' : 'Load Entries'}
            </Button>
          </div>
          
          {diaries.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Diary Entries ({diaries.length}):</h3>
              <ul className="space-y-2">
                {diaries.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="text-sm border p-2 rounded">
                    <div><strong>ID:</strong> {entry.id}</div>
                    <div><strong>Mood:</strong> {entry.mood}</div>
                    <div><strong>Content:</strong> {entry.content}</div>
                    <div><strong>Created:</strong> {new Date(entry.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}