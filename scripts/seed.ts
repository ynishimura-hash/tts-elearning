/**
 * TTS e-ラーニング シードスクリプト
 *
 * 使い方:
 * 1. Supabaseダッシュボードで schema.sql を実行してテーブルを作成
 * 2. .env.local に SUPABASE_SERVICE_ROLE_KEY を設定
 * 3. npx tsx scripts/seed.ts を実行
 *
 * CSVファイルは /Users/yuyu24/2ndBrain/TTSシステム/ にあることを想定
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const CSV_DIR = '/Users/yuyu24/2ndBrain/TTSシステム'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function readCSV(filename: string): Record<string, string>[] {
  const content = readFileSync(`${CSV_DIR}/${filename}`, 'utf-8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  })
}

async function seedCourses() {
  console.log('🔄 コースを投入中...')
  const rows = readCSV('コース.csv')

  for (const row of rows) {
    await supabase.from('courses').insert({
      name: row['コース名'] || row['Name'] || '',
      description: row['コース概要'] || null,
      sort_order: parseInt(row['並び順'] || '0') || 0,
      video_url: row['コース説明動画URL'] || null,
      is_2nd_year: row['2年目以降解放'] === 'TRUE',
      is_3rd_year: false,
      is_debut_required: row['本番デビュー以降解放'] === 'TRUE',
      is_free: row['無料特典'] === 'TRUE',
      is_online: row['オンライン受講生用'] === 'TRUE',
      viewable_after_days: parseInt(row['閲覧可能経過日数'] || '0') || 0,
      download_url: row['資料一括ダウンロード'] || null,
    })
  }
  console.log(`✅ ${rows.length} コースを投入完了`)
}

async function seedContents() {
  console.log('🔄 コンテンツを投入中...')
  const rows = readCSV('コンテンツ.csv')

  // コース名からIDへのマッピング
  const { data: courses } = await supabase.from('courses').select('id, name')
  const courseMap: Record<string, string> = {}
  courses?.forEach(c => { courseMap[c.name] = c.id })

  let count = 0
  for (const row of rows) {
    const courseName = row['コース'] || ''
    const courseId = courseMap[courseName]

    if (!courseId) {
      console.warn(`⚠️ コースが見つかりません: "${courseName}"`)
      continue
    }

    await supabase.from('contents').insert({
      course_id: courseId,
      name: row['コンテンツ名'] || '',
      youtube_url: row['YOUTUBE_URL'] || null,
      slide_url: row['スライドURL'] || null,
      sort_order: parseInt(row['並び順'] || '0') || 0,
      quiz_question: row['小テスト問題'] || null,
      quiz_option_1: row['選択肢①'] || null,
      quiz_option_2: row['選択肢②'] || null,
      quiz_option_3: row['選択肢③'] || null,
      quiz_option_4: row['選択肢④'] || null,
      quiz_answer: row['答え'] || null,
      quiz_explanation: row['解説'] || null,
      is_required: row['必須'] !== 'FALSE',
      notes: row['注釈'] || null,
      is_online: row['オンライン受講生用'] === 'TRUE',
    })
    count++
  }
  console.log(`✅ ${count} コンテンツを投入完了`)
}

async function seedFAQs() {
  console.log('🔄 Q&Aを投入中...')

  // 対面Q&A
  const offlineRows = readCSV('Q&A.csv')
  for (const row of offlineRows) {
    await supabase.from('faqs').insert({
      question: row['Question'] || '',
      answer: row['Answer'] || '',
      link_text: row['LINK表示テキスト'] || null,
      link_url: row['LINK'] || null,
      sort_order: parseInt(row['並び順'] || '0') || 0,
      is_online: false,
    })
  }

  // オンラインQ&A
  const onlineRows = readCSV('オンライン_Q&A.csv')
  for (const row of onlineRows) {
    await supabase.from('faqs').insert({
      question: row['Question'] || '',
      answer: row['Answer'] || '',
      link_text: row['LINK表示テキスト'] || null,
      link_url: row['LINK'] || null,
      sort_order: parseInt(row['並び順'] || '0') || 0,
      is_online: true,
    })
  }

  console.log(`✅ ${offlineRows.length + onlineRows.length} Q&Aを投入完了`)
}

async function seedBlog() {
  console.log('🔄 ブログを投入中...')

  // カテゴリー
  const catRows = readCSV('Blogカテゴリー.csv')
  const catMap: Record<string, string> = {}
  for (const row of catRows) {
    const { data } = await supabase.from('blog_categories').insert({
      name: row['カテゴリー名'] || row['Name'] || '',
    }).select('id').single()
    if (data) {
      catMap[row['ID'] || ''] = data.id
    }
  }

  // ブログ記事
  const blogRows = readCSV('Blog.csv')
  for (const row of blogRows) {
    await supabase.from('blog_posts').insert({
      title: row['タイトル'] || '',
      content: row['内容'] || '',
      rule_name: row['ルール'] || null,
      published: true,
    })
  }

  console.log(`✅ ${catRows.length} カテゴリー + ${blogRows.length} 記事を投入完了`)
}

async function seedStudySessions() {
  console.log('🔄 勉強会日程を投入中...')

  // 対面勉強会
  const offlineRows = readCSV('勉強会日程.csv')
  for (const row of offlineRows) {
    const dateStr = row['日程'] || ''
    // "2026年3月22日(日)" のような形式をパース
    const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
    const date = match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : dateStr

    await supabase.from('study_sessions').insert({
      title: `${row['月数'] || ''}月勉強会`,
      session_date: date || new Date().toISOString(),
      is_online: false,
    })
  }

  // オンライン勉強会
  const onlineRows = readCSV('オンライン勉強会日程.csv')
  for (const row of onlineRows) {
    const dateStr = row['日程'] || ''
    const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
    const date = match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : dateStr

    await supabase.from('study_sessions').insert({
      title: `${row['月数'] || ''}月オンライン勉強会`,
      session_date: date || new Date().toISOString(),
      is_online: true,
    })
  }

  console.log(`✅ ${offlineRows.length + onlineRows.length} 勉強会日程を投入完了`)
}

async function seedAnnouncements() {
  console.log('🔄 お知らせを投入中...')
  const rows = readCSV('オンラインお知らせ.csv')

  for (const row of rows) {
    await supabase.from('announcements').insert({
      title: row['タイトル'] || '',
      link_url: row['リンク先'] || null,
      is_online: true,
    })
  }

  console.log(`✅ ${rows.length} お知らせを投入完了`)
}

async function main() {
  console.log('🚀 TTS シードスクリプト開始\n')

  try {
    await seedCourses()
    await seedContents()
    await seedFAQs()
    await seedBlog()
    await seedStudySessions()
    await seedAnnouncements()

    console.log('\n🎉 全データの投入が完了しました！')
    console.log('\n📌 次のステップ:')
    console.log('1. Supabaseダッシュボードでユーザーを作成')
    console.log('2. usersテーブルにプロフィールを追加')
    console.log('3. npm run dev でサーバーを起動')
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error)
    process.exit(1)
  }
}

main()
