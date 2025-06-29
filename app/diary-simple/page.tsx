'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export default function DiarySimplePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          setError(`Auth error: ${error.message}`);
          return;
        }

        setUser(user);
        
        if (user) {
          // Test database connection
          const { data, error: dbError } = await supabase
            .from('diaries')
            .select('*')
            .eq('user_id', user.id)
            .limit(1);
            
          if (dbError) {
            setError(`Database error: ${dbError.message}`);
          }
        }
      } catch (err) {
        setError(`Unexpected error: ${err}`);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div>
      <h1>Simple Diary Test</h1>
      <p>User: {user.email}</p>
      <p>Status: OK</p>
    </div>
  );
}