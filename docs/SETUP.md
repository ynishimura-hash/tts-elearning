# TTS e-ラーニング セットアップガイド

## 前提条件

- Node.js 20 以上
- Supabase プロジェクト

## 1. プロジェクトのクローン

```bash
cd /Users/yuyu24/2ndBrain/TTSシステム/app
npm install
```

## 2. 環境変数の設定

`.env.local` を作成:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gywjxrxuzwxujlxbocvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
RESEND_API_KEY=<Resend APIキー>
CRON_SECRET=<任意の秘密鍵>
```

## 3. データベースのセットアップ

Supabase ダッシュボードの SQL Editor で `src/db/schema.sql` を実行。

## 4. テストデータの投入

```bash
npx tsx scripts/seed-quick.ts
```

248件のCSVデータを全て投入する場合:

```bash
npm install csv-parse
npx tsx scripts/seed.ts
```

## 5. テストユーザーの作成

Supabase ダッシュボード → Authentication → Add user:
- Email: `test@tts.com`
- Password: `test1234`

作成後、SQL Editor で users テーブルにプロフィールを追加:

```sql
INSERT INTO users (auth_id, email, full_name, customer_id, is_admin)
VALUES ('<User UID>', 'test@tts.com', 'テスト太郎', '0001', false);
```

管理者アカウントの場合:
```sql
INSERT INTO users (auth_id, email, full_name, customer_id, is_admin)
VALUES ('<Admin UID>', 'admin@tts.com', '管理者', 'ADMIN', true);
```

## 6. 開発サーバーの起動

```bash
npm run dev -- -p 3015
```

ブラウザで http://localhost:3015 を開く。

## 7. 本番ビルド

```bash
# ASCIIパスのディレクトリにコピーしてビルド（日本語パスバグ回避）
cp -r . /tmp/tts-build
cd /tmp/tts-build
npm install
npm run build
```

## 8. Vercel デプロイ

```bash
npx vercel --prod --yes
```

## 勉強会リマインダーの設定

リマインダーAPIを定期実行するには、Vercel Cron Jobs または外部のCronサービスを使用:

```bash
# 毎日朝9時に実行
curl -X POST https://your-domain.com/api/reminders \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Vercel の場合、`vercel.json` に設定:
```json
{
  "crons": [{
    "path": "/api/reminders",
    "schedule": "0 0 * * *"
  }]
}
```
