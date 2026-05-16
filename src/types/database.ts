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
  created_at: string
  updated_at: string
  paypal_subscription_id?: string | null
  last_payment_at?: string | null
  last_payment_amount?: number | null
  last_payment_transaction_id?: string | null
  last_login_at?: string | null
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
