/**
 * trademasternikkei225@gmail.com 用 PayPal 入金通知 GAS
 *
 * 用途: ピークボトムジグザグツール（月額）の利用料金 PayPal 入金通知を
 *      LINE グループに送るだけのシンプル版。
 *      TTS の申し込み→アカウント発行フローはこのアカウントでは扱わない。
 *
 * セットアップ手順:
 * 1. trademasternikkei225@gmail.com にログイン
 * 2. https://script.google.com を開いて「新しいプロジェクト」を作成
 * 3. プロジェクト名: 「TradeMaster PayPal 通知」など
 * 4. デフォルトの Code.gs に本ファイルの内容をコピペ
 * 5. 下の「設定項目」の LINE_TOKEN と TARGET_ID を、既存（オンライン用）の
 *    GAS と同じ値で埋める
 *    ※ 平文をメール・Slack・LINE で渡さない。1Password 等で安全に展開する
 * 6. 一度手動で checkTradeMasterPayPalAndNotify を実行して権限承認
 * 7. 「トリガー」から時間ベースのトリガーを設定:
 *      - 関数: checkTradeMasterPayPalAndNotify
 *      - イベント: 時間主導型
 *      - 頻度: 5分おき（または希望の間隔）
 * 8. 同様に checkTradeMasterSubscriptionStarted のトリガーも追加（任意）
 *
 * 注意:
 * - LINE_TOKEN, TARGET_ID は機密情報。コードを共有する際は値を伏せること。
 * - PayPal メールの本文形式が変わった場合は parsePayPalEmail を調整。
 */


// ===========================================
// 設定項目（既存オンライン用GASと同じ値を入れる）
// ===========================================
const LINE_TOKEN = '';   // 既存GAS（オンライン用）と同じ Channel Access Token
const TARGET_ID  = '';   // 既存GAS（オンライン用）と同じ LINE グループID


// ===========================================
// 「支払いを受け取りました」メール → LINE 通知（TTS API 連携なし）
// ===========================================
function checkTradeMasterPayPalAndNotify() {
  const query = 'from:service-jp@paypal.com subject:"支払いを受け取りました" is:unread';
  const threads = GmailApp.search(query);

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    messages.forEach(function(msg) {
      if (!msg.isUnread()) return;
      const body = msg.getPlainBody();
      const parsed = parsePayPalEmail(body, msg.getDate());

      // 情報抽出失敗時は警告を送って既読化
      if (!parsed.transaction_id) {
        sendLineMessage(
          '⚠ PayPalメールから情報抽出失敗（TradeMaster）\n' +
          '件名: ' + msg.getSubject() + '\n' +
          'email: ' + (parsed.customer_email || '取れず') + '\n' +
          'transaction_id: ' + (parsed.transaction_id || '取れず') + '\n\n' +
          '本文先頭1500字:\n' + body.substring(0, 1500)
        );
        msg.markRead();
        return;
      }

      const amountText = parsed.amount ? '¥' + Number(parsed.amount).toLocaleString() : '不明';
      const lineMsg =
        '💰 PayPal 入金あり（TradeMaster）\n\n' +
        '📅 ' + parsed.received_at + '\n' +
        '👤 ' + (parsed.customer_name || '不明') + '\n' +
        '📧 ' + (parsed.customer_email || '不明') + '\n' +
        '💴 ' + amountText + '\n' +
        '📦 ' + (parsed.product_name || 'ピークボトムジグザグツール') + '\n' +
        '🧾 取引ID: ' + parsed.transaction_id +
        (parsed.subscription_id ? '\n🔁 定期支払いID: ' + parsed.subscription_id : '');

      sendLineMessage(lineMsg);
      msg.markRead();
    });
  });
}


// ===========================================
// 「新しい自動支払い設定があります」メール → LINE 通知
// ===========================================
function checkTradeMasterSubscriptionStarted() {
  const query = 'from:service-jp@paypal.com subject:"新しい自動支払い設定があります" is:unread';
  const threads = GmailApp.search(query);

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    messages.forEach(function(msg) {
      if (!msg.isUnread()) return;
      const subject = msg.getSubject();
      const m = subject.match(/^(.+?)様/);
      const name = m ? m[1] : '?';
      const receivedAt = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

      sendLineMessage(
        '🆕 PayPal 新規サブスク契約（TradeMaster）\n\n' +
        '📅 ' + receivedAt + '\n' +
        '👤 ' + name + '\n\n' +
        '間もなく「支払いを受け取りました」メールが届き、自動で入金通知が流れます。'
      );
      msg.markRead();
    });
  });
}


// ===========================================
// PayPal メール本文から情報抽出（オンライン用と同じロジック + 商品名対応）
// ===========================================
function parsePayPalEmail(body, msgDate) {
  const result = {
    customer_email: null,
    customer_name: null,
    subscription_id: null,
    transaction_id: null,
    amount: null,
    product_name: null,
    received_at: null
  };
  let m;

  // 取引ID（アスタリスク付き対応）
  m = body.match(/\*?取引ID[*:：\s　]*\*?\s*([A-Z0-9]{10,25})/);
  if (m) result.transaction_id = m[1].trim();

  // 顧客メール
  m = body.match(/顧客のメールアドレス[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (m) result.customer_email = m[1];
  if (!result.customer_email) {
    const allEmails = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const payer = allEmails.find(function(e) { return e.indexOf('paypal.com') === -1; });
    if (payer) result.customer_email = payer;
  }

  // 顧客名
  m = body.match(/\*?顧客名[*:：\s　]*\*?\s*([^\n\r*<]+)/);
  if (m) result.customer_name = m[1].trim();

  // 定期支払いID
  m = body.match(/\*?定期支払いID[*:：\s　]*\*?\s*([A-Z0-9I][A-Z0-9-]{4,})/);
  if (m) result.subscription_id = m[1].trim();

  // 受取額
  m = body.match(/受取額[\s　*]*¥?\s*([\d,]+(?:\.\d+)?)/);
  if (m) result.amount = parseFloat(m[1].replace(/,/g, ''));

  // 商品名（「〇〇様から〇〇の支払いを受け取りました」の〇〇部分）
  m = body.match(/様から\s*(.+?)\s*の支払いを受け取りました/);
  if (m) result.product_name = m[1].trim();
  // フォールバック：「対象」フィールド
  if (!result.product_name) {
    m = body.match(/\*?対象[*:：\s　]*\*?\s*([^\n\r*<]+)/);
    if (m) result.product_name = m[1].trim();
  }

  result.received_at = Utilities.formatDate(msgDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  return result;
}


// ===========================================
// LINE Push 共通ヘルパー
// ===========================================
function sendLineMessage(text) {
  if (!LINE_TOKEN || !TARGET_ID) {
    console.warn('LINE_TOKEN / TARGET_ID 未設定');
    return;
  }
  const url = 'https://api.line.me/v2/bot/message/push';
  UrlFetchApp.fetch(url, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    'method': 'post',
    'payload': JSON.stringify({
      'to': TARGET_ID,
      'messages': [{ 'type': 'text', 'text': text }]
    }),
    'muteHttpExceptions': true
  });
}
