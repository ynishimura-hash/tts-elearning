/**
 * 全ページスクリーンショット撮影（ログイン含む）
 */
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:3015'
const DIR = '/Users/yuyu24/Desktop/スクリーンショット/TTS'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
  })

  const page = await context.newPage()

  // ---- ログインページ ----
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${DIR}/01_login.png`, fullPage: true })
  console.log('✅ 01_login')

  // ---- ログイン実行 ----
  await page.fill('input[type="email"]', 'test@tts.com')
  await page.fill('input[type="password"]', 'test1234')
  await page.screenshot({ path: `${DIR}/02_login_filled.png`, fullPage: true })
  console.log('✅ 02_login_filled')

  await page.click('button[type="submit"]')
  // ログイン後のリダイレクト待ち
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${DIR}/03_after_login.png`, fullPage: true })
  console.log(`✅ 03_after_login (${page.url()})`)

  // ログインに成功してるか確認
  const currentUrl = page.url()
  const isLoggedIn = !currentUrl.includes('/login')
  console.log(`ログイン状態: ${isLoggedIn ? '成功' : '失敗'} (${currentUrl})`)

  // ---- 対面受講生ページ群 ----
  const allPages = [
    { path: '/home', name: '04_home' },
    { path: '/courses', name: '05_courses' },
    { path: '/study-sessions', name: '06_study_sessions' },
    { path: '/qa', name: '07_qa' },
    { path: '/questions', name: '08_questions' },
    { path: '/consultation', name: '09_consultation' },
    { path: '/tools', name: '10_tools' },
    { path: '/community', name: '11_community' },
    { path: '/campaign', name: '12_campaign' },
    { path: '/mypage', name: '13_mypage' },
    { path: '/progress', name: '14_progress' },
    { path: '/blog', name: '15_blog' },
  ]

  for (const p of allPages) {
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)
      await page.screenshot({ path: `${DIR}/${p.name}.png`, fullPage: true })
      console.log(`✅ ${p.name} (${page.url()})`)
    } catch (e: any) {
      console.error(`❌ ${p.name}: ${e.message?.slice(0, 100)}`)
    }
  }

  // ---- コース詳細・コンテンツ詳細 ----
  try {
    await page.goto(`${BASE_URL}/courses`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)
    const courseLink = page.locator('a[href^="/courses/"]').first()
    if (await courseLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await courseLink.click()
      await page.waitForTimeout(3000)
      await page.screenshot({ path: `${DIR}/16_course_detail.png`, fullPage: true })
      console.log(`✅ 16_course_detail (${page.url()})`)

      const contentLink = page.locator('a[href*="/contents/"]').first()
      if (await contentLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await contentLink.click()
        await page.waitForTimeout(3000)
        await page.screenshot({ path: `${DIR}/17_content_view.png`, fullPage: true })
        console.log(`✅ 17_content_view (${page.url()})`)
      }
    }
  } catch (e: any) {
    console.error(`❌ course detail: ${e.message?.slice(0, 100)}`)
  }

  // ---- 申込フォーム（別セッション、非認証） ----
  try {
    const anonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' })
    const applyPage = await anonCtx.newPage()
    await applyPage.goto(`${BASE_URL}/apply`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await applyPage.waitForTimeout(2000)
    await applyPage.screenshot({ path: `${DIR}/18_apply.png`, fullPage: true })
    console.log('✅ 18_apply')
    await anonCtx.close()
  } catch (e: any) {
    console.error(`❌ apply: ${e.message?.slice(0, 100)}`)
  }

  await browser.close()
  console.log(`\n📸 全スクリーンショットを ${DIR} に保存しました`)
}

main()
