-- TTS e-ラーニングシステム データベーススキーマ
-- Supabase PostgreSQL

-- ユーザープロフィール
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  full_name TEXT NOT NULL,
  customer_id TEXT UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  is_free_user BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  withdrew_at TIMESTAMPTZ,
  account_issued_at TIMESTAMPTZ DEFAULT NOW(),
  debut_date TIMESTAMPTZ,
  is_debuted BOOLEAN DEFAULT FALSE,
  profile_image TEXT,
  drive_folder_url TEXT,
  myrule_permitted BOOLEAN DEFAULT FALSE,
  community_member BOOLEAN DEFAULT FALSE,
  simulation_years NUMERIC,
  verification_patterns INTEGER,
  current_video_no INTEGER DEFAULT 1,
  last_content TEXT,
  last_quiz_no INTEGER,
  curriculum TEXT,
  auto_read_path TEXT,
  auto_read_permitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- コース
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,
  video_url TEXT,
  is_2nd_year BOOLEAN DEFAULT FALSE,
  is_3rd_year BOOLEAN DEFAULT FALSE,
  is_debut_required BOOLEAN DEFAULT FALSE,
  is_free BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  viewable_after_days INTEGER DEFAULT 0,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- コンテンツ
CREATE TABLE contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  youtube_url TEXT,
  slide_url TEXT,
  pdf_url TEXT,
  sort_order INTEGER DEFAULT 0,
  next_content_id UUID,
  quiz_question TEXT,
  quiz_option_1 TEXT,
  quiz_option_2 TEXT,
  quiz_option_3 TEXT,
  quiz_option_4 TEXT,
  quiz_answer TEXT,
  quiz_explanation TEXT,
  is_required BOOLEAN DEFAULT TRUE,
  notes TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 受講進捗
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
  video_completed BOOLEAN DEFAULT FALSE,
  quiz_completed BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- FAQ
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  link_text TEXT,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ブログカテゴリー
CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ブログ記事
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  image1_url TEXT,
  image2_url TEXT,
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  rule_name TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- お知らせ
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  link_url TEXT,
  image_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 勉強会日程
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  session_date TIMESTAMPTZ NOT NULL,
  session_time TEXT,
  location TEXT,
  zoom_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  description TEXT,
  max_participants INTEGER,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 勉強会出欠
CREATE TABLE study_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'attending', 'absent', 'undecided')),
  responded_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- 受講申込
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  course_type TEXT DEFAULT 'offline' CHECK (course_type IN ('offline', 'online')),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  auto_reply_sent BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- トレードルール
CREATE TABLE trade_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  direction TEXT,
  trigger_rule TEXT,
  take_profit TEXT,
  exit_rule TEXT,
  record_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 最終テスト
CREATE TABLE final_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_1 TEXT NOT NULL,
  option_2 TEXT NOT NULL,
  option_3 TEXT NOT NULL,
  option_4 TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 最終テスト結果
CREATE TABLE final_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  passed BOOLEAN DEFAULT FALSE,
  score INTEGER,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- メッセージ（管理者→ユーザー通知）
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT CHECK (target_role IN ('all', 'offline', 'online', 'free')),
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trade_rules_updated_at BEFORE UPDATE ON trade_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS ポリシー
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ユーザー: 自分のプロフィールのみ閲覧・更新可能、管理者は全件
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "users_admin_all" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- コース: 認証済みユーザーは閲覧可能
CREATE POLICY "courses_select_authenticated" ON courses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "courses_admin_all" ON courses FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- コンテンツ: 認証済みユーザーは閲覧可能
CREATE POLICY "contents_select_authenticated" ON contents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "contents_admin_all" ON contents FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- 受講進捗: 自分の進捗のみ
CREATE POLICY "progress_own" ON user_progress FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "progress_admin_select" ON user_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- FAQ: 認証済みユーザーは閲覧可能
CREATE POLICY "faqs_select_authenticated" ON faqs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "faqs_admin_all" ON faqs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- ブログ: 公開記事は全員、管理者は全件
CREATE POLICY "blog_select_published" ON blog_posts FOR SELECT TO authenticated USING (published = TRUE);
CREATE POLICY "blog_admin_all" ON blog_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "blog_categories_select" ON blog_categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "blog_categories_admin" ON blog_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- お知らせ: 認証済みユーザーは閲覧可能
CREATE POLICY "announcements_select" ON announcements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "announcements_admin" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- 勉強会: 認証済みユーザーは閲覧可能
CREATE POLICY "sessions_select" ON study_sessions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sessions_admin" ON study_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- 出欠: 自分の出欠のみ操作可能
CREATE POLICY "attendance_own" ON study_session_attendance FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "attendance_admin" ON study_session_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- 申込: 匿名ユーザーは作成のみ、管理者は全件
CREATE POLICY "applications_insert" ON applications FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "applications_admin" ON applications FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- トレードルール: 認証済みユーザーは閲覧可能
CREATE POLICY "rules_select" ON trade_rules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "rules_admin" ON trade_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- 最終テスト
CREATE POLICY "final_tests_select" ON final_tests FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "final_tests_admin" ON final_tests FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "final_test_results_own" ON final_test_results FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "final_test_results_admin" ON final_test_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);

-- メッセージ
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "messages_admin" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE)
);
