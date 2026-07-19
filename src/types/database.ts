export type UserRole = 'offline' | 'online' | 'admin' | 'free'

export interface User {
  id: string
  auth_id: string
  email: string
  username: string
  full_name: string
  customer_id: string
  role: UserRole
  is_admin: boolean
  is_online: boolean
  is_free_user: boolean
  is_on_leave: boolean
  joined_at: string | null
  withdrew_at: string | null
  account_issued_at: string | null
  debut_date: string | null
  is_debuted: boolean
  profile_image: string | null
  drive_folder_url: string | null
  myrule_permitted: boolean
  community_member: boolean
  simulation_years: number | null
  verification_patterns: number | null
  current_video_no: number | null
  last_content: string | null
  last_quiz_no: number | null
  curriculum: string | null
  auto_read_path: string | null
  auto_read_permitted: boolean
  is_test: boolean
  is_tester: boolean
  is_verifier?: boolean
  created_at: string
  updated_at: string
  paypal_subscription_id?: string | null
  last_payment_at?: string | null
  last_payment_amount?: number | null
  last_payment_transaction_id?: string | null
  last_login_at?: string | null
  // LINE 公式アカウント連携（2チャネル運用）
  // - online: オンライン公式LINE の userId（オンライン会員 + テスター）
  // - offline: オフライン公式LINE の userId（オフライン会員のみ。テスターは NULL）
  line_user_id_online?: string | null
  line_user_id_offline?: string | null
  // 勉強会通知（出欠案内・催促・2週間前自動通知）を送るか。false で対象外。既定 true
  study_notify_enabled?: boolean
  // 進捗報告の自動催促（LINE）を最後に送った日時。cron の重複送信防止用
  progress_reminded_at?: string | null
  // 2年目 / 3年目コースの手動解放。true なら経過日数を問わず閲覧できる（管理画面で設定）
  year2_unlocked?: boolean
  year3_unlocked?: boolean
}

// 進捗報告（受講生の自己申告。提出後は編集不可）
export interface ProgressReport {
  id: string
  user_id: string
  current_topic: string | null
  content: string
  reported_at: string
  created_at: string
}

export interface Course {
  id: string
  name: string
  description: string | null
  sort_order: number
  image_url: string | null
  video_url: string | null
  is_2nd_year: boolean
  is_3rd_year: boolean
  is_debut_required: boolean
  is_free: boolean
  is_online: boolean
  viewable_after_days: number
  download_url: string | null
  created_at: string
  updated_at: string
}

export interface Content {
  id: string
  course_id: string
  name: string
  youtube_url: string | null
  slide_url: string | null
  pdf_url: string | null
  sort_order: number
  next_content_id: string | null
  quiz_question: string | null
  quiz_option_1: string | null
  quiz_option_2: string | null
  quiz_option_3: string | null
  quiz_option_4: string | null
  quiz_answer: string | null
  quiz_explanation: string | null
  duration: string | null
  is_required: boolean
  notes: string | null
  is_online: boolean
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  content_id: string
  video_completed: boolean
  quiz_completed: boolean
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
  link_text: string | null
  link_url: string | null
  video_url: string | null
  sort_order: number
  is_online: boolean
  created_at: string
  updated_at: string
}

export interface BlogPost {
  id: string
  title: string
  content: string
  image1_url: string | null
  image2_url: string | null
  category_id: string | null
  rule_name: string | null
  author_id: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface BlogCategory {
  id: string
  name: string
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  link_url: string | null
  image_url: string | null
  is_online: boolean
  study_session_id: string | null
  created_at: string
  updated_at: string
}

export interface StudySession {
  id: string
  title: string
  session_date: string
  session_time: string | null
  location: string | null
  zoom_url: string | null
  is_online: boolean
  description: string | null
  max_participants: number | null
  reminder_sent: boolean
  auto_notify_enabled: boolean
  two_week_notify_sent_at: string | null
  // 段階通知エンジン
  notify_1month_at?: string | null
  remind_1week_at?: string | null
  remind_1day_at?: string | null
  notify_skip?: string[] | null
  created_at: string
  updated_at: string
}

export interface StudySessionAttendance {
  id: string
  session_id: string
  user_id: string
  status: 'pending' | 'attending' | 'absent' | 'undecided'
  responded_at: string | null
  notes: string | null
  reminder_count: number
  last_reminder_at: string | null
  created_at: string
}

export interface Application {
  id: string
  full_name: string
  email: string
  phone: string | null
  course_type: 'offline' | 'online'
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  auto_reply_sent: boolean
  processed_at: string | null
  created_at: string
  // オンライン申込フォーム拡張
  furigana: string | null
  birthdate: string | null
  postal_code: string | null
  address: string | null
  referral_source: string | null
  referral_detail: string | null
  payment_status: 'unpaid' | 'paid' | 'cancelled'
  payment_confirmed_at: string | null
  payment_confirmed_by: string | null
  user_id: string | null
  // LINE 公式アカウント連携（2チャネル運用）
  line_user_id_online: string | null
  line_user_id_offline: string | null
}

// 申し込み受付状態（1行運用）
export interface ApplicationSettings {
  id: boolean
  online_paused: boolean
  offline_paused: boolean
  online_paused_at: string | null
  offline_paused_at: string | null
  updated_at: string
}

// 空き待ち申込
export interface WaitlistApplication {
  id: string
  full_name: string
  furigana: string
  email: string
  phone: string
  birthdate: string
  postal_code: string
  address: string
  referral_source: string
  referral_detail: string | null
  course_type: 'online' | 'offline'
  status: 'waiting' | 'invited' | 'converted' | 'cancelled'
  invite_token: string | null
  invite_sent_at: string | null
  invite_expires_at: string | null
  converted_application_id: string | null
  converted_at: string | null
  line_user_id: string | null
  created_at: string
}

// LINE 公式アカウント
export type LineChannel = 'online' | 'offline'

// LINE グループ / トーク / 個人（line_groups テーブル）
export interface LineGroup {
  id: string
  group_id: string
  source_type: 'user' | 'group' | 'room'
  channel: LineChannel
  display_name: string | null
  is_peak_bottom_target: boolean
  last_event_type: string | null
  last_event_at: string | null
  created_at: string
}

// LINE 連携トークン（公式LINEで「連携」と発言したユーザーに発行）
// 専用URLで氏名 + 電話番号フォームを表示し、users テーブルと突合する
export interface LineLinkToken {
  token: string
  line_user_id: string
  channel: LineChannel
  source_type: string
  created_at: string
  expires_at: string
  used_at: string | null
  linked_user_id: string | null
}

export interface TradeRule {
  id: string
  name: string
  direction: string | null
  trigger: string | null
  take_profit: string | null
  exit_rule: string | null
  record_url: string | null
  created_at: string
  updated_at: string
}
