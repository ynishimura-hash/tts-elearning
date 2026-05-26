# GAS スクリプト

PayPal 入金メールを検知して LINE グループに通知する Google Apps Script のソース管理用ディレクトリ。
Google Apps Script 上で動作するため、このリポジトリにコードを置いても自動デプロイはされない。
**バックアップ・履歴管理用**として保管している。

---

## ファイル一覧

| ファイル | 動作アカウント | 役割 |
|---------|--------------|------|
| `trademaster-paypal-notify.gs` | `trademasternikkei225@gmail.com` | ピークボトムジグザグツールの PayPal 入金通知 → LINEグループ通知のみ |

※ オンライン受講用（TTS API 連携あり）の GAS は別アカウントで稼働中。本リポジトリには含めていない。

---

## セットアップ手順（trademaster-paypal-notify.gs）

1. `trademasternikkei225@gmail.com` にログイン
2. https://script.google.com を開いて「新しいプロジェクト」
3. プロジェクト名を「TradeMaster PayPal 通知」などに変更
4. `Code.gs` を開き、`trademaster-paypal-notify.gs` の中身を全てコピペ
5. ファイル冒頭の `LINE_TOKEN` と `TARGET_ID` を埋める
   - 既存（オンライン用）GAS と同じ値を 1Password 等から安全に取得して貼り付ける
   - **平文をメール・Slack・LINE で受け渡さないこと**
6. `checkTradeMasterPayPalAndNotify` を一度手動実行
   - 権限承認ダイアログが出るので承認
7. 左側「トリガー」アイコン → トリガー追加
   - 実行する関数: `checkTradeMasterPayPalAndNotify`
   - イベントのソース: 時間主導型
   - タイプ: 分ベースのタイマー → 5分おき
8. 同様に `checkTradeMasterSubscriptionStarted` のトリガーも追加（任意）

---

## トラブル時

- メール本文形式が PayPal 側で変わった場合は `parsePayPalEmail` の正規表現を調整
- LINE 通知が来ない場合
  - `LINE_TOKEN` が正しいか
  - `TARGET_ID` のグループに Bot が参加しているか
  - 「実行数」タブで失敗ログを確認
