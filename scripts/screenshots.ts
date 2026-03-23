/**
 * TTS e-ラーニング スクリーンショット撮影スクリプト
 */
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:3015'
const SCREENSHOT_DIR = '/Users/yuyu24/Desktop/スクリーンショット/TTS'

const pages = [
  { path: '/login', name: '01_login' },
  { path: '/apply', name: '02_apply' },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
  })

  for (const page of pages) {
    const p = await context.newPage()
    try {
      await p.goto(`${BASE_URL}${page.path}`, { waitUntil: 'networkidle', timeout: 15000 })
      await p.waitForTimeout(1000)
      await p.screenshot({ path: `${SCREENSHOT_DIR}/${page.name}.png`, fullPage: true })
      console.log(`✅ ${page.name}: ${page.path}`)
    } catch (e: any) {
      console.error(`❌ ${page.name}: ${e.message}`)
    }
    await p.close()
  }

  await browser.close()
  console.log(`\n📸 スクリーンショットを ${SCREENSHOT_DIR} に保存しました`)
}

main()
