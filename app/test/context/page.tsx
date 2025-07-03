'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContextTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [characterId, setCharacterId] = useState(1);

  const runTest = async (action: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/context-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          characterId
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Request failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Context Management Test</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Character ID:
          </label>
          <select 
            value={characterId} 
            onChange={(e) => setCharacterId(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={1}>1 - 鈴木ハジメ</option>
            <option value={2}>2 - 星野推子</option>
            <option value={3}>3 - スマイリー中村</option>
            <option value={4}>4 - カズママ</option>
            <option value={5}>5 - さとり和尚</option>
            <option value={6}>6 - 本田菜</option>
            <option value={7}>7 - 織田ノブ</option>
            <option value={8}>8 - ミーコ</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button 
            onClick={() => runTest('collect_context')}
            disabled={loading}
          >
            1. Collect Context
          </Button>
          
          <Button 
            onClick={() => runTest('view_context_data')}
            disabled={loading}
          >
            2. View Context Data
          </Button>
          
          <Button 
            onClick={() => runTest('build_chat_context')}
            disabled={loading}
          >
            3. Build Chat Context
          </Button>
          
          <Button 
            onClick={() => runTest('process_weekly')}
            disabled={loading}
          >
            4. Process Weekly Summary
          </Button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="text-lg">Processing...</div>
          </div>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Test Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
        
        <div className="mt-8 text-sm text-gray-600">
          <h3 className="font-medium mb-2">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>First, select a character and click "1. Collect Context" to gather existing data</li>
            <li>Click "2. View Context Data" to see what was collected</li>
            <li>Click "3. Build Chat Context" to see how context would be used in chat</li>
            <li>Click "4. Process Weekly Summary" to test weekly summarization</li>
          </ol>
          
          <div className="mt-4">
            <h4 className="font-medium">Expected Results:</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Collect Context: Should gather chat, diary, and feedback data</li>
              <li>View Data: Should show rawContext and summaries arrays</li>
              <li>Build Context: Should return formatted context string</li>
              <li>Weekly Summary: Should process and create summaries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}