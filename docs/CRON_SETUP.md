# Daily Feedback Cron Job Setup

このドキュメントでは、毎日午前4時にキャラクターからのフィードバックを自動生成するためのcronジョブ設定について説明します。

## 環境変数

以下の環境変数を設定してください：

```bash
# OpenAI API key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Cron job authentication secret (required)
CRON_SECRET=your_secure_random_string_here
```

## エンドポイント

### 本番用: `/api/cron/daily-feedback`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer ${CRON_SECRET}`
- **用途**: 外部cronサービスからの呼び出し

### 開発/テスト用: `/api/admin/generate-feedbacks`
- **Method**: POST
- **用途**: 手動でのフィードバック生成テスト

## Vercel Cronジョブ設定

Vercelでcronジョブを設定する場合、`vercel.json`に以下を追加：

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-feedback",
      "schedule": "0 4 * * *"
    }
  ]
}
```

## 外部cronサービス設定例

### 1. EasyCron
- URL: `https://yourdomain.com/api/cron/daily-feedback`
- Method: POST
- Schedule: `0 4 * * *` (毎日午前4時)
- Headers: `Authorization: Bearer your_cron_secret`

### 2. GitHub Actions
`.github/workflows/daily-feedback.yml`:

```yaml
name: Daily Feedback Generation
on:
  schedule:
    - cron: '0 4 * * *'  # 毎日午前4時 (UTC)
  workflow_dispatch:  # 手動実行も可能

jobs:
  generate-feedback:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Daily Feedback
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://yourdomain.com/api/cron/daily-feedback
```

### 3. cron-job.org
- URL: `https://yourdomain.com/api/cron/daily-feedback`
- Method: POST
- Schedule: `0 4 * * *`
- Headers: `Authorization: Bearer your_cron_secret`

## 動作確認

### 1. 手動テスト (開発環境)
```bash
curl -X POST http://localhost:3000/api/admin/generate-feedbacks
```

### 2. 本番cronテスト
```bash
curl -X POST \
  -H "Authorization: Bearer your_cron_secret" \
  https://yourdomain.com/api/cron/daily-feedback
```

### 3. ヘルスチェック
```bash
curl https://yourdomain.com/api/cron/daily-feedback
```

## ログ監視

cronジョブの実行状況は以下で確認できます：

1. **Vercelダッシュボード**: Functions タブでログを確認
2. **アプリケーションログ**: console.log出力を確認
3. **レスポンス**: APIレスポンスでステータス確認

## トラブルシューティング

### 問題: フィードバックが生成されない
- OpenAI API keyが正しく設定されているか確認
- 昨日の日記エントリが存在するか確認
- キャラクターデータが正しくDBに登録されているか確認

### 問題: 401エラー
- CRON_SECRETが正しく設定されているか確認
- Authorizationヘッダーの形式が正しいか確認

### 問題: 500エラー
- OpenAI API制限に達していないか確認
- Supabaseの接続設定を確認
- ログでエラー詳細を確認

## セキュリティ注意事項

1. **CRON_SECRET**: ランダムで推測困難な文字列を使用
2. **API Key**: OpenAI API keyは安全に管理
3. **ログ**: APIキーなどの機密情報をログに出力しない
4. **レート制限**: OpenAI APIの制限を考慮して実装