# Google Apps Script (GAS) スクリプト全文

GAS は **`kudo@creatte.jp` のアカウント**で運用されています。Gmail を読んで LINE グループに通知する役割。

---

## 関数一覧

| 関数名 | 役割 | トリガー |
|---|---|---|
| `checkTtsPayPalAndNotify` | 「支払いを受け取りました」メール検知 → TTS API + LINE通知 | 5分おき |
| `checkTtsPayPalSubscriptionStarted` | 「新しい自動支払い設定があります」メール検知 → 契約成立通知のみ | 5分おき |
| `checkTtsApplyAndNotify` | TTS ピークボトム申請通知メール検知 → LINE通知 | 5分おき |
| `parsePayPalEmail` | PayPal メール本文から必要情報を抽出（ヘルパー） | – |
| `sendLineMessage` | LINE Push API ヘルパー | – |

## PayPal が送る2種類のメール

| 件名 | 内容 | 担当関数 |
|---|---|---|
| **支払いを受け取りました** | 実際の入金通知（顧客情報・取引ID・金額あり） | `checkTtsPayPalAndNotify` |
| **{名前}様に対する新しい自動支払い設定があります** | サブスク契約成立通知 | `checkTtsPayPalSubscriptionStarted` |

初回サブスク時は **両方届く**。月次更新は「支払いを受け取りました」だけ。

---

## 全文（コピペ用）

```javascript
// ===========================================
// 設定項目
// ===========================================
// ⚠ TTS公式LINE（事務局/旧）のチャネルアクセストークン
// ※ TTSオンライン公式LINE（受講生用）ではない
// 事務局グループに送信するBOTのトークン
const LINE_TOKEN = '<TTS公式LINE_CHANNEL_ACCESS_TOKEN>';

// 通知先のLINEグループID（事務局メンバーが入っているグループ）
const TARGET_ID = '<TTS事務局グループのGroupID>';

// TTS PayPal連携APIエンドポイント
const TTS_PAYPAL_API = 'https://tts-e.vercel.app/api/payments/paypal-notify';

// TTS API認証用シークレットトークン（Vercel側のPAYPAL_NOTIFY_TOKENと一致）
const TTS_PAYPAL_TOKEN = '<TTS_PAYPAL_TOKEN>';


// ===========================================
// PayPal 入金通知 → TTS連携 + LINE通知
// ===========================================
function checkTtsPayPalAndNotify() {
  const query = 'from:service-jp@paypal.com "支払いを受け取りました" is:unread';
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      if (!msg.isUnread()) return;
      const body = msg.getPlainBody();
      const parsed = parsePayPalEmail(body, msg.getDate());

      if (!parsed.customer_email || !parsed.transaction_id) {
        sendLineMessage('⚠ PayPalメールから情報抽出失敗\n手動確認をお願いします');
        msg.markRead();
        return;
      }

      // TTS API 呼び出し
      let result;
      try {
        const res = UrlFetchApp.fetch(TTS_PAYPAL_API, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            token: TTS_PAYPAL_TOKEN,
            customer_email: parsed.customer_email,
            customer_name: parsed.customer_name,
            subscription_id: parsed.subscription_id,
            transaction_id: parsed.transaction_id,
            amount: parsed.amount,
            currency: 'JPY'
          }),
          muteHttpExceptions: true
        });
        result = JSON.parse(res.getContentText());
      } catch (e) {
        sendLineMessage('❌ TTS API 呼び出し失敗: ' + e.toString());
        return;
      }

      const amountText = parsed.amount ? '¥' + Number(parsed.amount).toLocaleString() : '不明';
      const baseInfo =
        '📅 ' + parsed.received_at + '\n' +
        '👤 ' + parsed.customer_name + '\n' +
        '📧 ' + parsed.customer_email + '\n' +
        '💰 ' + amountText;

      let lineMsg;
      if (result.status === 'processed') {
        lineMsg = '🎉 TTS 申込→入金確認→アカウント発行完了\n\n' +
          baseInfo + '\n' +
          '顧客ID: ' + result.customer_id + '\n\n' +
          (result.drive_ok ? '✓ Driveフォルダ作成' : '⚠ Drive失敗') + '\n' +
          (result.mail_sent ? '✓ ウェルカムメール送信' : '⚠ メール失敗') + '\n' +
          (result.line_pushed ? '✓ 本人LINE通知' : '― LINE未紐付け');
      } else if (result.status === 'no_action') {
        lineMsg = '💰 TTS 月額継続課金\n\n' + baseInfo;
      } else if (result.status === 'duplicate_initial' || result.status === 'duplicate_recurring') {
        // 既処理済みなので通知しない
        msg.markRead();
        return;
      } else {
        lineMsg = '❌ TTS 処理エラー\n\n' + baseInfo + '\n\n' + JSON.stringify(result);
      }

      sendLineMessage(lineMsg);
      msg.markRead();
    });
  });
}


// PayPal メール本文から必要情報を抽出
// NOTE: getPlainBody() はHTMLの <b>取引ID:</b> を *取引ID:* に変換するため
//       アスタリスク付きのパターンにも対応する
function parsePayPalEmail(body, msgDate) {
  const result = {
    customer_email: null, customer_name: null,
    subscription_id: null, transaction_id: null,
    amount: null, received_at: null
  };
  let m;

  // 取引ID: *取引ID:*XXXXX 形式にも対応
  m = body.match(/\*?取引ID[*:：\s　]*\*?\s*([A-Z0-9]{10,25})/);
  if (m) result.transaction_id = m[1].trim();

  // 顧客メール: 複数パターンで順番に試行
  // パターン1: "顧客のメールアドレス" セクション（管理者向けPDFメール形式）
  m = body.match(/顧客のメールアドレス[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (m) result.customer_email = m[1];
  // パターン2: "メールアドレス:" ラベル（HTML変換形式）
  if (!result.customer_email) {
    m = body.match(/メールアドレス[:：\s　]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (m) result.customer_email = m[1];
  }
  // パターン3: 本文中の全メールアドレスから paypal.com 以外を採用
  if (!result.customer_email) {
    const allEmails = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const payer = allEmails.find(function(e) { return e.indexOf('paypal.com') === -1; });
    if (payer) result.customer_email = payer;
  }

  // 顧客名: 複数パターンで順番に試行
  m = body.match(/顧客名[\s　]+([^\n\r]+)/);
  if (m) result.customer_name = m[1].trim();
  if (!result.customer_name) {
    m = body.match(/お名前[:：\s　]+([^\n\r]+)/);
    if (m) result.customer_name = m[1].trim();
  }

  // 定期支払いID: アスタリスク付きにも対応
  m = body.match(/\*?定期支払いID[*:：\s　]*\*?\s*([A-Z0-9I][A-Z0-9-]{4,})/);
  if (m) result.subscription_id = m[1].trim();

  // 受取額: アスタリスク・スペース付きにも対応
  m = body.match(/受取額[\s　*]*¥?\s*([\d,]+(?:\.\d+)?)/);
  if (m) result.amount = parseFloat(m[1].replace(/,/g, ''));

  // 受信日時（日本時間でフォーマット）
  result.received_at = Utilities.formatDate(msgDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  return result;
}


// ===========================================
// PayPal 新規サブスク契約通知 → LINE（情報通知のみ）
// 件名: "○○様に対する新しい自動支払い設定があります"
// 入金処理は checkTtsPayPalAndNotify が担うので、ここは通知だけ
// ===========================================
function checkTtsPayPalSubscriptionStarted() {
  const query = 'from:service-jp@paypal.com "新しい自動支払い設定があります" is:unread';
  const threads = GmailApp.search(query);

  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    messages.forEach(function(msg) {
      if (!msg.isUnread()) return;

      const subject = msg.getSubject();
      const date = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

      // 件名から顧客名を抽出 例: "MATSUDA TOMOKO様に対する新しい自動支払い設定があります"
      const nameMatch = subject.match(/^(.+?)様に対する新しい自動支払い設定があります/);
      const customerName = nameMatch ? nameMatch[1] : '不明';

      const lineMsg =
        '📋 TTS 新規サブスク契約\n\n' +
        '📅 ' + date + '\n' +
        '👤 ' + customerName + '\n\n' +
        '⏳ まもなく入金確認メールが届きます';

      sendLineMessage(lineMsg);
      msg.markRead();
    });
  });
}


// ===========================================
// TTS ピークボトム申請通知 → LINE
// ===========================================
function checkTtsApplyAndNotify() {
  const query = 'from:trademasternikkei225@gmail.com subject:"【TTS申請通知】" is:unread';
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      if (msg.isUnread()) {
        const body = msg.getPlainBody();
        const subject = msg.getSubject();
        const messageText = '🛠 ' + subject + '\n\n' + body;
        sendLineMessage(messageText);
        msg.markRead();
      }
    });
  });
}


// ===========================================
// LINE Push 共通ヘルパー
// ===========================================
function sendLineMessage(text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  UrlFetchApp.fetch(url, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'to': TARGET_ID,
      'messages': [{ 'type': 'text', 'text': text }]
    })
  });
}
```

---

## 設定値（実際の値はリポジトリにコミットせず、GASエディタとVercelで管理）

| 変数 | 値の取得元 | 保存場所 |
|---|---|---|
| `LINE_TOKEN` | **TTS公式LINE（事務局/旧）** の Messaging API > チャネルアクセストークン（長期） | GASエディタ |
| `TARGET_ID` | TTS事務局LINEグループID（C5560f99...） | GASエディタ |
| `TTS_PAYPAL_TOKEN` | TTSシステムの Vercel環境変数 `PAYPAL_NOTIFY_TOKEN` と同値 | GASエディタ + Vercel |

## ⚠ 重要：3つのLINE OAの使い分け（混同注意）

| LINE OA | 用途 | トークン保存場所 |
|---|---|---|
| **TTS公式LINE（事務局/旧）** | 事務局グループへのGAS通知 | **GAS の `LINE_TOKEN`** |
| **TTSオンライン公式LINE（新/受講生用）** | 受講生とのやりとり（リッチメニュー、Push、Webhook） | Vercel の `LINE_CHANNEL_ACCESS_TOKEN` |
| Lステップ用 | 廃止予定 | – |

GASは事務局グループに送信するので「TTS公式LINE（事務局）」の方のトークンが必要。  
TTSオンライン公式LINEのトークンを GAS に入れると 401 エラーになる。

---

## 別途運用しているGAS Web App（Drive複製用）

**オーナー: `trademasternikkei225@gmail.com`**（kudo@creatte.jp とは別アカウント）

```javascript
// === TTSオンライン 受講生フォルダ自動複製 ===
const TTS_TEMPLATE_FOLDER_ID = '1sW0LgiU5Sh8q87pSfYAcDR88sETbOgiD';
const TTS_PARENT_FOLDER_ID = '1cNSZoO-9ZxpSbmDhfUSROCsJdHGuSn2u';
const TTS_DRIVE_TOKEN = '<TTS_DRIVE_TOKEN>';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TTS_DRIVE_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const studentName = body.studentName;
    const customerId = body.customerId;
    if (!studentName || !customerId) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'missing studentName or customerId' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const newFolderName = customerId + '_' + studentName + '様';
    const parentFolder = DriveApp.getFolderById(TTS_PARENT_FOLDER_ID);

    const existing = parentFolder.getFoldersByName(newFolderName);
    if (existing.hasNext()) {
      const folder = existing.next();
      return ContentService.createTextOutput(JSON.stringify({
        folderUrl: folder.getUrl(),
        folderId: folder.getId(),
        existed: true,
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const templateFolder = DriveApp.getFolderById(TTS_TEMPLATE_FOLDER_ID);
    const newFolder = parentFolder.createFolder(newFolderName);
    copyFolderContents(templateFolder, newFolder);

    return ContentService.createTextOutput(JSON.stringify({
      folderUrl: newFolder.getUrl(),
      folderId: newFolder.getId(),
      existed: false,
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function copyFolderContents(srcFolder, destFolder) {
  const files = srcFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    file.makeCopy(file.getName(), destFolder);
  }
  const subFolders = srcFolder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const newSub = destFolder.createFolder(sub.getName());
    copyFolderContents(sub, newSub);
  }
}
```

### Web App デプロイ設定
- 種類: ウェブアプリ
- 次のユーザーとして実行: 自分（trademasternikkei225@gmail.com）
- アクセスできるユーザー: 全員（トークン認証で守る）
- URL: Vercel環境変数 `GAS_DRIVE_WEBAPP_URL` に設定済み

---

## トリガー一覧（GAS エディタの時計アイコン）

### kudo@creatte.jp の GAS

| 関数 | 種類 | 頻度 |
|---|---|---|
| `checkTtsPayPalAndNotify` | 時間主導型 | 5分おき |
| `checkTtsPayPalSubscriptionStarted` | 時間主導型 | 5分おき |
| `checkTtsApplyAndNotify` | 時間主導型 | 5分おき |

### trademasternikkei225@gmail.com の GAS（Drive複製用）
- トリガー不要（Web App として呼び出される）

---

## 編集時の注意

- **トークンを誤ってコミットしない**（このファイルでは `<LINE_CHANNEL_ACCESS_TOKEN>` のように仮置き）
- LINE Channel Access Token を再発行したら、GAS と Vercel `LINE_CHANNEL_ACCESS_TOKEN` 両方更新
- TTS_PAYPAL_TOKEN を再発行したら、GAS と Vercel `PAYPAL_NOTIFY_TOKEN` 両方更新

---

## 動作確認の手順

### PayPal連携の手動テスト
1. GASエディタで `checkTtsPayPalAndNotify` を選択
2. ▶ 実行
3. 未読のPayPal通知メールがあれば、TTS APIを叩いて結果に応じてLINEグループに通知

### ピークボトム申請通知の手動テスト
1. GASエディタで `checkTtsApplyAndNotify` を選択
2. ▶ 実行
3. 未読の `【TTS申請通知】` メールがあればLINEグループに転送

最終更新: 2026-05-09
