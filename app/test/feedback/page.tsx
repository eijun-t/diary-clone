'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestFeedbackPage() {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testCreateSampleFeedback = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test/create-sample-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult({
        status: response.status,
        data: data
      });
    } catch (error) {
      setResult({
        status: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testCreateCharacterTables = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test/check-tables', {
        method: 'GET',
      });

      const data = await response.json();
      setResult({
        status: response.status,
        data: data
      });
    } catch (error) {
      setResult({
        status: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSchema = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test/create-schema', {
        method: 'POST',
      });

      const data = await response.json();
      setResult({
        status: response.status,
        data: data
      });
    } catch (error) {
      setResult({
        status: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen muute-gradient">
      <div className="container mx-auto max-w-lg p-4">
        <Card className="muute-card">
          <CardHeader>
            <CardTitle>フィードバック機能テスト</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">ステップ1: テーブル確認</h3>
              <p className="text-sm text-muted-foreground mb-3">
                キャラクターテーブルの存在を確認します
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={testCreateCharacterTables}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  テーブル確認
                </Button>
                <Button 
                  onClick={createSchema}
                  disabled={isLoading}
                  className="w-full"
                >
                  テーブル作成（開発用）
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">ステップ2: サンプルフィードバック作成</h3>
              <p className="text-sm text-muted-foreground mb-3">
                既存の日記エントリに対してサンプルフィードバックを作成します
              </p>
              <Button 
                onClick={testCreateSampleFeedback}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'テスト中...' : 'サンプルフィードバック作成'}
              </Button>
            </div>

            {result && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">結果:</h3>
                <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                  <pre className="text-sm">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                <a href="/diary" className="text-primary hover:underline">
                  ← 日記ページに戻る
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}