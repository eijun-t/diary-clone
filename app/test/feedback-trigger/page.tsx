'use client';

import { useState } from 'react';

export default function FeedbackTriggerPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/test/trigger-daily-feedback', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'APIの呼び出しに失敗しました。');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">フィードバック生成テスト</h1>
      <p className="mb-4">
        下のボタンをクリックすると、日次フィードバックを生成するバッチ処理を手動で実行します。
      </p>
      
      <button
        onClick={handleTrigger}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
      >
        {isLoading ? '処理中...' : 'フィードバック生成を開始'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h2 className="font-bold">処理成功</h2>
          <pre className="mt-2 whitespace-pre-wrap break-all text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h2 className="font-bold">エラー</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
} 