# 申込・入金・アカウント発行 全体フロー

TTS オンライン受講生のオンボーディングフロー全体を、データの流れと処理を含めて記述。

---

## 関係者・システム

| 略称 | 内容 |
|---|---|
| 受講生 | 申し込みする本人 |
| TTSオンライン公式LINE | LINE Messaging API（kudo@creatte.jp ではない別アカウント） |
| TTSシステム | Vercel上の Next.js アプリ（tts-e.vercel.app） |
| GAS（kudo） | `kudo@creatte.jp` の Google Apps Script |
| GAS（trademaster） | `trademasternikkei225@gmail.com` の GAS Web App（Drive複製用） |
| 事務局LINEグループ | 通知先のLINEグループ（GroupID: C5560f99...） |

---

## メインフロー（リッチメニュー経由・推奨）

```
┌────────────────────────────────────────────────────────────┐
│ 1. 受講生がTTSオンライン公式LINE友だち追加                    │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ 2. リッチメニュー「申し込み」をタップ                         │
│    → 「申し込み」テキストが送信される                          │
└──────────────────────┬─────────────────────────────────────┘
                       ↓ Webhook
┌────────────────────────────────────────────────────────────┐
│ 3. TTSシステム /api/line/webhook                              │
│    ・「申し込み」検知                                          │
│    ・apply_invite_tokens に token (UUID) 発行                 │
│      (line_user_id と紐付け、有効期限7日)                     │
│    ・Push API で URL 送信:                                    │
│      https://tts-e.vercel.app/apply/online?token=xxx         │
│      ※ LINE OA「一律応答」と並行送信される                    │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ 4. 受講生がURL開く → /apply/online にアクセス                 │
│    ・上部に「LINE公式アカウントと連携中」緑バナー表示          │
│    ・8項目入力（メール・氏名・ふりがな・電話・生年月日・郵便  │
│      ・住所・きっかけ）                                       │
│    ・「申し込む」ボタン                                        │
└──────────────────────┬─────────────────────────────────────┘
                       ↓ POST
┌────────────────────────────────────────────────────────────┐
│ 5. /api/apply/online                                          │
│    ・token から line_user_id を解決                            │
│    ・applications に INSERT                                    │
│      ・status = 'approved'（最初から入金待ち扱い）             │
│      ・payment_status = 'unpaid'                               │
│      ・line_user_id 保存                                       │
│    ・自動返信メール送信（PayPal リンク入り）                   │
│      宛先: 申込者のメール                                      │
│      BCC: kudo@creatte.jp                                     │
│    ・LINE Push（line_user_id に対して PayPalリンク送信）       │
│    ・apply_invite_tokens.used_at 更新                          │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ 6. 受講生が PayPal で支払い                                   │
│    https://www.paypal.com/webapps/billing/plans/subscribe...  │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ 7. PayPal が入金通知メールを送信                              │
│    From: service-jp@paypal.com                                │
│    To: kudo@creatte.jp（PayPal に登録された受取人）           │
└──────────────────────┬─────────────────────────────────────┘
                       ↓ 5分以内
┌────────────────────────────────────────────────────────────┐
│ 8. GAS（kudo）の checkTtsPayPalAndNotify が検知              │
│    ・メール本文をパース（顧客名・メール・取引ID・金額・サブID）│
│    ・POST → /api/payments/paypal-notify                       │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ 9. /api/payments/paypal-notify                                │
│    ① 取引ID重複チェック → 既処理ならスキップ                  │
│    ② applications を email AND payment_status='unpaid' で検索 │
│       ┌──────────────────────────┐                            │
│       │ 一致あり = 申込→入金       │                            │
│       └────────┬─────────────────┘                            │
│                ↓                                               │
│       【自動アカウント発行フル処理】                            │
│       ・next_customer_id 採番（例: 0008）                      │
│       ・GAS Web App 経由で Drive フォルダ複製                  │
│         → 「0008_片山 和奏様」のフォルダ作成                    │
│       ・users に INSERT                                        │
│         (is_online=true, drive_folder_url保存)                 │
│       ・Supabase Auth に作成 + 12桁ランダム仮パスワード        │
│       ・ウェルカムメール送信（テンプレ詳細は                   │
│         PAYMENT_NOTIFICATIONS.md）                            │
│       ・本人にLINE Push（line_user_id 紐付け済みなら）         │
│       ・applications を paid + approved に更新                 │
│       ・paypal_payments に履歴記録（is_initial=true）          │
│       ・users.last_payment_at 更新                             │
│       → status: 'processed'                                    │
│                                                                │
│       ┌──────────────────────────┐                            │
│       │ 一致なし = 月次 or 既存    │                            │
│       └────────┬─────────────────┘                            │
│                ↓                                               │
│       【ライト処理】                                           │
│       ・users を email 一致で検索                              │
│       ・あれば users.last_payment_at だけ更新                  │
│       ・paypal_subscription_id 未設定なら自動紐付け            │
│       ・paypal_payments には書かない                           │
│       → status: 'no_action'                                    │
└──────────────────────┬─────────────────────────────────────┘
                       ↓ レスポンス
┌────────────────────────────────────────────────────────────┐
│ 10. GAS が結果に応じてLINEグループに通知                      │
│     processed → 🎉 申込→入金確認→アカウント発行完了           │
│     no_action → 💰 月額継続課金                                │
│     error      → ❌ エラー                                     │
└────────────────────────────────────────────────────────────┘
```

---

## 手動入金完了フロー（管理者操作）

PayPal 通知メールが届かない/未連携の場合、管理者が手動で対応：

```
[/admin/applications で対象申込を開く]
        ↓
[ステータスドロップダウン → 「入金済み」を選択]
        ↓
[POST → /api/admin/applications/[id]/confirm-payment]
        ↓
【自動処理】（PayPal自動と同じ）
  ・customer_id 採番
  ・GAS Web App で Drive 複製
  ・users 作成 + Supabase Auth + 仮pw
  ・ウェルカムメール送信
  ・LINE Push（line_user_id 紐付けあり時）
  ・applications を paid に
  ・paypal_payments には書かない（手動なので取引IDなし）
  ・users.last_payment_at 更新
        ↓
[管理画面に成功トースト表示]
```

---

## ピークボトムツール申請の通知フロー（参考）

```
[受講生が /online/peak-bottom/apply で申請]
        ↓
[POST → /api/peak-bottom/apply]
        ↓
【処理】
  ・peak_bottom_applications に INSERT (status='pending')
  ・kudo@creatte.jp 宛にメール送信
    件名: 【TTS申請通知】反対線ピークボトムツール - 山田太郎
        ↓ 5分以内
[GAS（kudo）の checkTtsApplyAndNotify が検知]
        ↓
[LINE グループに転送]
        ↓
[管理者が /admin/peak-bottom で「登録完了」ボタン]
        ↓
[POST → /api/admin/peak-bottom/[id]/complete]
        ↓
【処理】
  ・peak_bottom_applications.status を completed に
  ・※ LINE通知などはなし（手動連絡の方針）
```

---

## DB スキーマ（関連テーブル）

### applications
| カラム | 説明 |
|---|---|
| id | UUID PK |
| course_type | 'online' / 'offline' |
| status | 'pending' / 'approved' / 'rejected' |
| payment_status | 'unpaid' / 'paid' / 'cancelled' |
| email, full_name, furigana, phone, birthdate, postal_code, address | 申込者情報 |
| referral_source, referral_detail | きっかけ |
| line_user_id | LINE紐付け済みなら設定 |
| paypal_subscription_id | 入金完了時に保存 |
| user_id | 紐付いた users.id |

### apply_invite_tokens
| カラム | 説明 |
|---|---|
| token | UUID PK（URLパラメータ） |
| line_user_id | リッチメニュータップ時の LINE userId |
| created_at, expires_at | 有効期限 7日 |
| used_at | 使用済みならタイムスタンプ |

### paypal_payments
| カラム | 説明 |
|---|---|
| id | UUID PK |
| transaction_id | 一意制約。PayPal取引ID |
| subscription_id | 定期支払いID |
| payer_email, payer_name | 支払者情報 |
| amount, currency | 金額 |
| is_initial | 初回ならtrue |
| user_id | 紐付いたユーザー |
| received_at | 受信日時 |

**初回入金のみ insert される**。月次は users.last_payment_* のみ更新。

### users（PayPal関連）
| カラム | 説明 |
|---|---|
| paypal_subscription_id | 紐付いたサブスクID |
| last_payment_at | 最終入金日時 |
| last_payment_amount | 最終入金額 |
| last_payment_transaction_id | 最終取引ID |

---

## ステータス3段階の意味

管理画面のドロップダウンで切り替え可能：

| ステータス | DB値 | 意味 |
|---|---|---|
| 申し込み済み | status='pending' | 古いフロー用（現状未使用） |
| 入金待ち | status='approved' AND payment_status='unpaid' | フォーム送信直後はこれ。PayPalリンク送信済み |
| 入金済み | payment_status='paid' | アカウント発行完了 |

---

## 環境変数（Vercel）

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー側 |
| `GMAIL_USER` | trademasternikkei225@gmail.com |
| `GMAIL_APP_PASSWORD` | Gmailアプリパスワード（Sensitive） |
| `LINE_CHANNEL_ACCESS_TOKEN` | TTSオンライン公式LINE Bot |
| `LINE_CHANNEL_SECRET` | Webhook 署名検証用 |
| `GAS_DRIVE_WEBAPP_URL` | Drive複製用 GAS Web App URL |
| `GAS_DRIVE_TOKEN` | GAS認証トークン（Sensitive） |
| `PAYPAL_NOTIFY_TOKEN` | GAS→TTS API 認証トークン（Sensitive） |
| `PEAK_BOTTOM_NOTIFY_TO` | ピークボトム申請通知の宛先（kudo@creatte.jp） |

---

## 関連ドキュメント

- [PAYMENT_NOTIFICATIONS.md](./PAYMENT_NOTIFICATIONS.md) - 送信文面のテンプレート集
- [GAS_SCRIPTS.md](./GAS_SCRIPTS.md) - GAS スクリプト全文
- [WALKTHROUGH.md](./WALKTHROUGH.md) - 機能別ガイド
- [SPEC.md](./SPEC.md) - システム仕様

最終更新: 2026-05-09
