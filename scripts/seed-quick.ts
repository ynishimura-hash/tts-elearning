/**
 * テストデータ投入スクリプト（REST API経由）
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gywjxrxuzwxujlxbocvd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2p4cnh1end4dWpseGJvY3ZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE2MTc4NSwiZXhwIjoyMDg5NzM3Nzg1fQ.xyIOaXjfMX-R02EzPJYooAT5g5B7mfRAMX1Nn-5zHCw'
)

async function main() {
  // コースIDを取得
  const { data: courses } = await supabase.from('courses').select('id, name')
  if (!courses || courses.length === 0) {
    console.error('コースが見つかりません')
    return
  }

  const courseMap: Record<string, string> = {}
  courses.forEach(c => { courseMap[c.name] = c.id })
  console.log(`✅ ${courses.length} コース取得済み`)

  // コンテンツ投入（基礎知識編に5件）
  const kisoId = courseMap['基礎知識編']
  const kenshoId = courseMap['検証訓練編']
  const kisoOnId = courseMap['基礎知識編（オンライン）']
  const kenshoOnId = courseMap['検証訓練編（オンライン）']

  if (kisoId) {
    const { error } = await supabase.from('contents').insert([
      { course_id: kisoId, name: 'はじめに', sort_order: 1, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
      { course_id: kisoId, name: '資金管理', sort_order: 2, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', slide_url: 'https://docs.google.com/presentation/d/example', is_online: false,
        quiz_question: '資金管理で最も重要なのは？', quiz_option_1: '利益の最大化', quiz_option_2: '損失の最小化', quiz_option_3: '取引回数の増加', quiz_option_4: 'レバレッジの活用',
        quiz_answer: '損失の最小化', quiz_explanation: '資金管理の基本は、まず損失を限定することです。' },
      { course_id: kisoId, name: 'トレンド（ダウ理論）', sort_order: 3, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
      { course_id: kisoId, name: 'サポート・レジスタンス', sort_order: 4, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
      { course_id: kisoId, name: 'チャート設定について', sort_order: 5, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', notes: '※TradingViewの無料プランでの設定方法', is_online: false },
    ])
    console.log(error ? `❌ 基礎知識編コンテンツ: ${error.message}` : '✅ 基礎知識編 5件')
  }

  if (kenshoId) {
    const { error } = await supabase.from('contents').insert([
      { course_id: kenshoId, name: 'Step1：検証の準備', sort_order: 1, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
      { course_id: kenshoId, name: 'Step2：過去チャート検証', sort_order: 2, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
      { course_id: kenshoId, name: 'Step3：記録の付け方', sort_order: 3, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: false },
    ])
    console.log(error ? `❌ 検証訓練編: ${error.message}` : '✅ 検証訓練編 3件')
  }

  if (kisoOnId) {
    const { error } = await supabase.from('contents').insert([
      { course_id: kisoOnId, name: 'はじめに', sort_order: 1, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: true },
      { course_id: kisoOnId, name: '資金管理', sort_order: 2, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: true },
      { course_id: kisoOnId, name: 'トレンド（ダウ理論）', sort_order: 3, youtube_url: 'https://youtu.be/dQw4w9WgXcQ', is_online: true },
    ])
    console.log(error ? `❌ 基礎知識編(オンライン): ${error.message}` : '✅ 基礎知識編(オンライン) 3件')
  }

  // Q&A投入
  const { error: faqErr } = await supabase.from('faqs').insert([
    { question: '有料会員の期間はいつからいつまでですか？', answer: '入会日から1年間が有料会員期間となります。自動更新はありません。\n更新をご希望の場合は、期限前にLINEにてご連絡ください。', sort_order: 1, is_online: false },
    { question: '退会・休会制度はありますか？', answer: '退会はいつでも可能です。LINEにてご連絡ください。\n休会制度は現在ございません。', sort_order: 2, is_online: false },
    { question: '領収書は発行できますか？', answer: 'はい、発行可能です。LINEにてお名前と宛名をお知らせください。', sort_order: 3, is_online: false },
    { question: 'TradingViewはどのプランを使えばいいですか？', answer: '無料プランで十分学習可能です。有料プランでは複数のインジケーターを同時表示できるなどの利点があります。', sort_order: 4, is_online: false },
    { question: '有料会員の期間はいつからいつまでですか？', answer: '月額制の自動更新となります。解約はいつでも可能です。', sort_order: 1, is_online: true },
    { question: '解約方法を教えてください', answer: 'LINEにて解約希望の旨をご連絡ください。日割り計算はございません。', sort_order: 2, is_online: true },
    { question: 'ピークボトムツールの利用申請方法は？', answer: 'LINEにて「ピークボトムツール利用希望」とご連絡ください。審査後、ご利用いただけます。', sort_order: 3, is_online: true },
  ])
  console.log(faqErr ? `❌ FAQ: ${faqErr.message}` : '✅ FAQ 7件')

  // 勉強会日程
  const { error: sessErr } = await supabase.from('study_sessions').insert([
    { title: '3月勉強会', session_date: '2026-03-22T13:00:00+09:00', session_time: '13:00-16:00', location: '東京会場', is_online: false },
    { title: '4月勉強会', session_date: '2026-04-18T13:00:00+09:00', session_time: '13:00-16:00', location: '東京会場', is_online: false },
    { title: '5月勉強会', session_date: '2026-05-16T13:00:00+09:00', session_time: '13:00-16:00', location: '東京会場', is_online: false },
    { title: '3月オンライン勉強会', session_date: '2026-03-28T20:00:00+09:00', session_time: '20:00-22:00', zoom_url: 'https://zoom.us/j/example', is_online: true },
    { title: '4月オンライン勉強会', session_date: '2026-04-28T20:00:00+09:00', session_time: '20:00-22:00', zoom_url: 'https://zoom.us/j/example2', is_online: true },
  ])
  console.log(sessErr ? `❌ 勉強会: ${sessErr.message}` : '✅ 勉強会 5件')

  // ブログカテゴリー
  const { data: cats, error: catErr } = await supabase.from('blog_categories').insert([
    { name: 'スタッフトレード月間成績' },
    { name: 'スタッフトレード年間成績' },
    { name: 'コラム' },
  ]).select('id, name')
  console.log(catErr ? `❌ ブログカテゴリー: ${catErr.message}` : `✅ ブログカテゴリー ${cats?.length}件`)

  // ブログ記事
  const { error: blogErr } = await supabase.from('blog_posts').insert([
    { title: '2024年12月 月間成績', content: '2024年12月1日〜12月31日\n資金100万円スタート\n10勝2敗4引き分け\n+265,800円\n\n今月は比較的安定したトレードができました。', published: true, category_id: cats?.[0]?.id },
    { title: '2024年11月 月間成績', content: '2024年11月の成績をお知らせします。\n8勝3敗2引き分け\n+180,500円', published: true, category_id: cats?.[0]?.id },
  ])
  console.log(blogErr ? `❌ ブログ: ${blogErr.message}` : '✅ ブログ 2件')

  // お知らせ
  const { error: annErr } = await supabase.from('announcements').insert([
    { title: 'トレードポイント解説 2026年3月号を追加しました', is_online: true },
    { title: '4月勉強会の日程が確定しました', is_online: false },
  ])
  console.log(annErr ? `❌ お知らせ: ${annErr.message}` : '✅ お知らせ 2件')

  console.log('\n🎉 テストデータ投入完了!')
}

main()
