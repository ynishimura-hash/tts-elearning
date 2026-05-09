# Google Apps Script (GAS) スクリプト全文

GAS は **`kudo@creatte.jp` のアカウント**で運用されています。Gmail を読んで LINE グループに通知する役割。

---

## 関数一覧

| 関数名 | 役割 | トリガー |
|---|---|---|
| `checkTtsPayPalAndNotify` | PayPal 入金通知メールを検知し、TTS API 連携 + LINE通知 | 5分おき |
| `checkTtsApplyAndNotify` | TTS ピークボトム申請通知メールを検知し LINE通知 | 5分おき |
| `parsePayPalEmail` | PayPal メール本文から必要情報を抽出（ヘルパー） | – |
| `sendLineMessage` | LINE Push API ヘルパー | – |

---

## 全文（コピペ用）

```javascript
// ===========================================
// 設定項目
// ===========================================
// LINE Messaging API のチャネルアクセストークン（TTSオンライン公式LINE）
const LINE_TOKEN = '<LINE_CHANNEL_ACCESS_TOKEN>';

// 通知先のLINEグループID
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
function parsePayPalEmail(body, msgDate) {
  const result = {
    customer_email: null, customer_name: null,
    subscription_id: null, transaction_id: null,
    amount: null, received_at: null
  };
  let m;
  m = body.match(/顧客のメールアドレス[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (m) result.customer_email = m[1];
  m = body.match(/顧客名[\s　]+([^\n\r]+?)(?=\s*顧客のメール|\s*$)/);
  if (m) result.customer_name = m[1].trim();
  m = body.match(/定期支払いID[\s　]+([A-Z0-9-]+)/);
  if (m) result.subscription_id = m[1];
  m = body.match(/取引ID[:：\s　]+([A-Z0-9]+)/);
  if (m) result.transaction_id = m[1];
  m = body.match(/受取額[\s　]+¥?([\d,]+(?:\.\d+)?)/);
  if (m) result.amount = parseFloat(m[1].replace(/,/g, ''));
  // 受信日時（日本時間でフォーマット）
  result.received_at = Utilities.formatDate(msgDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  return result;
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
| `LINE_TOKEN` | LINE Developers > Messaging API設定 > チャネルアクセストークン（長期） | GASエディタ |
| `TARGET_ID` | 別途取得した TTS事務局LINEグループID | GASエディタ |
| `TTS_PAYPAL_TOKEN` | TTSシステムの Vercel環境変数 `PAYPAL_NOTIFY_TOKEN` と同値 | GASエディタ + Vercel |

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
