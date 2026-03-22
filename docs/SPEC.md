# TTS e-ラーニングシステム 仕様書

## 概要

TTS（トレード塾）のe-ラーニングシステム。
既存のAdaloアプリ（49画面）をNext.js + Supabaseで完全再構築。

### 基本情報

| 項目 | 値 |
|------|-----|
| プロジェクト名 | TTS e-ラーニング |
| 技術スタック | Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 |
| データベース | Supabase (PostgreSQL) |
| 認証 | Supabase Auth (Email/Password) |
| メール送信 | Resend |
| ポート(開発) | localhost:3015 |
| ブランドカラー | Primary: #384a8f (紺) / Secondary: #e39f3c (ゴールド) |

---

## ユーザー種別

| 種別 | 入口URL | 説明 |
|------|---------|------|
| 対面受講生 | `/home` | 会場での対面受講。勉強会は会場開催 |
| オンライン受講生 | `/online/home` | Zoom での遠隔受講。勉強会はZoom |
| 管理者 | `/admin` | コース・ユーザー・勉強会・ブログ・申込の管理 |
| 無料特典ユーザー | `/free/home` | 無料コンテンツのみ閲覧可能 |

ログイン時にユーザー種別に応じて自動リダイレクトされる。

---

## ページ遷移図

```
ログイン (/login)
  ├→ 対面受講生 HOME (/home)
  │   ├── コース一覧 (/courses)
  │   │   ├── コース詳細 (/courses/[id])
  │   │   │   └── コンテンツ視聴 (/courses/[id]/contents/[contentId])
  │   │   │       ├── YouTube動画視聴
  │   │   │       ├── スライド閲覧
  │   │   │       └── 小テスト
  │   ├── 勉強会 (/study-sessions) ← 出欠回答
  │   ├── 検証ツール (/tools)
  │   ├── 質問受付 (/questions)
  │   ├── 個別相談 (/consultation) ← 申込フォーム
  │   ├── Q&A (/qa) ← アコーディオン
  │   ├── コミュニティ (/community)
  │   ├── 紹介キャンペーン (/campaign)
  │   ├── みんなの進捗 (/progress)
  │   └── マイページ (/mypage) ← パスワード変更
  │
  ├→ オンライン受講生 HOME (/online/home)
  │   ├── コース一覧 (/online/courses)
  │   │   └── コース詳細 → コンテンツ視聴（対面と同構造）
  │   ├── 勉強会 (/online/study-sessions) ← Zoom URL表示
  │   ├── 検証ツール (/online/tools)
  │   ├── 質問受付 (/online/questions)
  │   ├── 個別相談 (/online/consultation)
  │   ├── Q&A (/online/qa)
  │   ├── 紹介キャンペーン (/online/campaign)
  │   └── マイページ (/online/mypage)
  │
  ├→ 管理者 HOME (/admin)
  │   ├── ユーザー管理 (/admin/users) ← 進捗確認・検索・フィルター
  │   ├── コース管理 (/admin/courses)
  │   │   └── コース詳細 (/admin/courses/[id])
  │   ├── 勉強会管理 (/admin/study-sessions) ← 作成・出欠確認・リマインド
  │   ├── ブログ管理 (/admin/blog)
  │   │   ├── 新規投稿 (/admin/blog/new)
  │   │   └── 編集 (/admin/blog/[id])
  │   ├── Q&A管理 (/admin/qa) ← 追加・削除
  │   └── 申込管理 (/admin/applications) ← 承認・却下
  │
  └→ 無料特典ユーザー HOME (/free/home)
      └── 無料コース (/free/courses)

公開ページ（認証不要）:
  ├── 受講申込 (/apply) ← 自動返信メール
  ├── ブログ (/blog)
  │   ├── 記事詳細 (/blog/[id])
  │   └── カテゴリー (/blog/category/[id])
  └── 有効期限切れ (/expired)

API:
  ├── POST /api/send-email ← メール送信（Resend）
  ├── POST /api/reminders ← 勉強会リマインド・催促
  └── GET  /api/auth/callback ← Supabase OAuth コールバック
```

---

## 主要機能

### 1. コース・コンテンツ学習

- **コース構成**: コース → コンテンツ（YouTube動画 + スライド + 小テスト）
- **段階的解放**: アカウント発行日からの経過日数に応じてコースが解放
  - 1年目コース: 即時 ～ 10日後
  - 2年目コース: 365日後
  - 3年目コース: 730日後
- **進捗管理**: 動画視聴完了 → 小テスト合格 → コンテンツ完了の3段階
- **小テスト**: 4択問題。正解するまで繰り返し、解説表示

### 2. 勉強会管理

- **日程設定**: 管理者が対面/オンラインの勉強会を作成
- **出欠管理**: 受講生がワンクリックで出席/欠席を回答
- **リマインド**: 3日前にメールでリマインダー送信（API経由）
- **催促**: 未回答者に催促メール送信
- **Zoom URL**: オンライン勉強会の出席回答者にのみZoom URLを表示

### 3. 受講生申込

- **公開フォーム**: 認証不要で申込可能（`/apply`）
- **対面/オンライン選択**: 受講形式を選択
- **自動返信**: 申込完了時に確認メールを自動送信
- **管理者画面**: 申込の承認/却下

### 4. Q&A・サポート

- **FAQ**: アコーディオン形式のQ&A（対面用・オンライン用を分離）
- **質問受付**: 質問方法の案内（勉強会・LINE）
- **個別相談**: 希望日時と相談内容を送信するフォーム

### 5. ブログ

- **カテゴリー分類**: スタッフ月間/年間成績、コラム等
- **管理者投稿**: 記事の作成・編集・公開/下書き切替・削除
- **トレードルール紐付け**: 記事に関連ルール名を付与

### 6. その他

- **コミュニティ**: 加入/未加入の状態表示
- **紹介キャンペーン**: 紹介コード（顧客ID）の表示・コピー
- **検証ツール**: ピークボトムツール申請案内、TradingView、売買記録テンプレート
- **みんなの進捗**: 全受講生の学習進捗ランキング
- **有効期限管理**: 退会日を過ぎたアカウントは専用画面へリダイレクト

---

## データベース設計（15テーブル）

| テーブル名 | 用途 | 主要カラム |
|-----------|------|-----------|
| `users` | ユーザープロフィール | auth_id, full_name, is_admin, is_online, is_free_user, account_issued_at |
| `courses` | コース管理 | name, sort_order, is_2nd_year, is_online, is_free, viewable_after_days |
| `contents` | コンテンツ管理 | course_id, name, youtube_url, slide_url, quiz_*, is_online |
| `user_progress` | 受講進捗 | user_id, content_id, video_completed, quiz_completed, completed |
| `faqs` | FAQ | question, answer, sort_order, is_online |
| `blog_categories` | ブログカテゴリー | name |
| `blog_posts` | ブログ記事 | title, content, category_id, published |
| `announcements` | お知らせ | title, link_url, is_online |
| `study_sessions` | 勉強会日程 | title, session_date, zoom_url, is_online |
| `study_session_attendance` | 勉強会出欠 | session_id, user_id, status, reminder_count |
| `applications` | 受講申込 | full_name, email, course_type, status |
| `trade_rules` | トレードルール | name, direction, trigger_rule, take_profit |
| `final_tests` | 最終テスト問題 | course_id, question, options, correct_answer |
| `final_test_results` | 最終テスト結果 | user_id, course_id, passed, score |
| `messages` | メッセージ通知 | title, body, target_role |

### RLSポリシー

- **ユーザー**: 自分のプロフィールのみ閲覧/更新可能。管理者は全件操作可能。
- **コース/コンテンツ/FAQ**: 認証済みユーザーは全て閲覧可能。管理者のみ編集可能。
- **進捗/出欠**: 自分のデータのみ操作可能。管理者は閲覧可能。
- **申込**: 匿名ユーザーは作成のみ。管理者は全件操作可能。
- **ブログ**: 公開記事は全員閲覧可能。管理者のみ編集可能。

---

## セキュリティ

- Supabase Auth による認証（Email/Password）
- Row Level Security (RLS) 全テーブルに適用
- Middleware でセッション検証 + 未認証ユーザーはログインへリダイレクト
- Service Role Key はサーバーサイドのみ使用
- CSRF保護（Next.js デフォルト）

---

## デプロイ

### 環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=https://gywjxrxuzwxujlxbocvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>  # サーバーサイドのみ
RESEND_API_KEY=<Resend API key>  # メール送信用
CRON_SECRET=<任意の秘密鍵>  # リマインダーAPI保護用
```

### Vercel デプロイ

```bash
npx vercel --prod --yes
```

### 開発サーバー

```bash
cd /Users/yuyu24/2ndBrain/TTSシステム/app
npm run dev -- -p 3015
```

> **注意**: Next.js 16 の Turbopack は日本語ディレクトリパスでバグが発生します。
> productionビルド（`npm run build`）は問題なく動作します。
> デプロイ先（Vercel等）ではASCIIパスになるため問題ありません。

---

## ファイル構成

```
src/
├── app/
│   ├── (auth)/           # 認証関連（ログイン、期限切れ）
│   ├── (offline)/        # 対面受講生用（11ページ）
│   ├── (online)/online/  # オンライン受講生用（10ページ）
│   ├── (admin)/admin/    # 管理者用（8ページ）
│   ├── (free)/free/      # 無料特典ユーザー用（2ページ）
│   ├── (public)/apply/   # 公開申込フォーム
│   ├── api/              # APIエンドポイント（3件）
│   └── blog/             # ブログ（3ページ）
├── components/           # 共通コンポーネント
│   ├── Navigation.tsx    # サイドバーナビゲーション
│   ├── YouTubePlayer.tsx # YouTube埋め込みプレーヤー
│   ├── ProgressBar.tsx   # 進捗バー
│   └── QuizModal.tsx     # 小テストモーダル
├── db/
│   └── schema.sql        # データベーススキーマ
├── lib/
│   ├── supabase/         # Supabase クライアント（client/server/middleware）
│   ├── hooks/useUser.ts  # ユーザー情報フック
│   └── utils.ts          # ユーティリティ関数
├── types/
│   └── database.ts       # 型定義
└── middleware.ts          # 認証ミドルウェア

scripts/
├── seed.ts               # CSVデータ投入スクリプト
└── seed-quick.ts         # テストデータ投入スクリプト
```

---

## 既知の制限事項

1. **Turbopack 日本語パスバグ**: devモードで一部ページがクラッシュ。productionビルドでは問題なし。
2. **メール送信**: Resend APIキー未設定時はメールをスキップ（エラーにはならない）。
3. **ファイルアップロード**: ブログ画像のアップロード機能は未実装（URL指定のみ）。
4. **CSVデータの完全投入**: 248件のコンテンツデータは `scripts/seed.ts` で投入可能（csv-parseの別途インストールが必要）。
