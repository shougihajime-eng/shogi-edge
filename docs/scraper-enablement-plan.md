# 自動取得 (B層) スクレイパー 有効化計画

> **このファイルの目的**: 連盟サイト復旧後、各サイトを1つずつ「規約OK確認 → 有効化」していくための手順書。
> **読み手**: はじめさん本人 (非エンジニア)。
> **基本方針**: 全部いっぺんに ON にしない。1つずつ確認しながら。

---

## 🚦 現在の状態

| 状況 | 詳細 |
|---|---|
| 全スクレイパー | **OFF** (デフォルト) |
| データ投入経路 | 管理画面の手入力 + CSV取込 |
| 連盟サイト | サーバ攻撃中で不安定 (2026-05-22 時点) |

---

## 📋 優先度と推奨順序

| 順位 | サイト | 重要度 | 規約OKの可能性 | 推奨タイミング |
|---:|---|:---:|:---:|---|
| **1** | **将棋連盟LIVE中継** (live.shogi.or.jp) | ⭐⭐⭐ | 中 | 連盟サイト復旧後すぐ・要規約確認 |
| **2** | **将棋連盟 公式 対局スケジュール** (shogi.or.jp/match) | ⭐⭐⭐ | 中 | 同上 |
| **3** | **将棋連盟 棋士DB** (shogi.or.jp/player) | ⭐⭐ | 中 | 段位・プロフィール自動更新用 |
| **4** | **将棋プレミアム** (shogi-premium.jp) | ⭐⭐ | 中 | 中継カバレッジ補完 |
| **5** | **将棋DB2** (shogidb2.com) | ⭐⭐ | 低 (個人運営・要連絡) | 棋譜・対戦成績の自動集計 |
| **6** | **将棋大会ナビ** (shogi-tournaments.vercel.app) | ⭐ | 低 (個人運営・要連絡) | アマ大会日程 |
| **7** | **アマ連盟** (shogi-amaren.com) | ⭐ | 中 | アマ棋戦結果 |
| **8** | **将棋レーティングサイト** (shogidata.info 等) | ⭐ | 中 | 独自レーティング参考 |
| **9** | **floodgate** (コンピュータ将棋) | ⭐ | 中 | レーティング参考 |
| **10** | **ABEMA将棋** (abema.tv) | ❌ | **NG** | **規約禁止のため恒久OFF推奨** |

---

## 🛠 有効化の手順 (どのサイトでも共通)

### 0. 規約OK確認 (これが一番大事)

サイトを開いて、以下のいずれかが明記されていないか確認:

- 「自動取得禁止」「クロール禁止」「スクレイピング禁止」
- 「APIを通さない大量アクセスは禁止」
- `robots.txt` で `Disallow: /` (全面禁止) になっていないか

確認方法 (非エンジニア向け):
- `https://サイトのURL/robots.txt` をブラウザで開く
- 規約・利用条件ページを開いて Ctrl+F で「自動」「クロール」「スクレイ」を検索

**個人運営サイト (将棋DB2 / 将棋大会ナビ)** は、規約がなくても事前にメール等で「自動取得していいですか」と連絡することを強く推奨。連絡先がない場合は OFF のまま。

### 1. Vercel ダッシュボードで環境変数を `true` に

クリックで有効化できるよう設計されています。コードは触らなくて OK。

1. https://vercel.com/shougihajime-3368s-projects/shogi-edge/settings/environment-variables を開く
2. 「Add New」をクリック
3. 以下を入力:
   - Name: `SCRAPER_<サイト名>_ENABLED` (各サイトの正式変数名は下記表参照)
   - Value: `true`
   - Environments: ✅ Production にチェック
4. 「Save」をクリック
5. 上部ナビ「Deployments」→ 最新の Production デプロイの右側 ⋯ メニュー → 「Redeploy」を選択 (環境変数を反映するため)

### 2. 動作確認

1. https://shogi-edge.vercel.app/admin/scraper-status にアクセス
2. 該当サイトのバッジが「ON」(朱色) になっていることを確認
3. 待つ:
   - スケジュール系 (連盟LIVE中継・公式 etc.) は **毎日 04:00 JST に巡回**
   - 結果系 (将棋DB2) も同じく
4. 翌朝、Supabase のテーブル (matches / head_to_head / players) に新規 row が増えていれば成功

### 3. 問題があったら戻す

問題例: アクセス過多で BAN された / 連盟から連絡が来た / データが壊れた

戻す手順:
1. Vercel ダッシュボードで該当環境変数を **削除** (または `false` に変更)
2. 「Redeploy」
3. 30秒後に再度 `/admin/scraper-status` で OFF を確認

---

## 🗂 各サイトの正式変数名一覧

| サイト | 環境変数名 | cron path |
|---|---|---|
| 将棋連盟LIVE中継 | `SCRAPER_LIVE_SHOGI_OR_JP_ENABLED` | `/api/cron/scrape-live-shogi-or-jp` |
| 将棋連盟 公式 | `SCRAPER_SHOGI_OR_JP_ENABLED` | `/api/cron/scrape-shogi-or-jp` |
| 将棋連盟 棋士DB | `SCRAPER_PLAYER_DB_ENABLED` | `/api/cron/scrape-player-db` |
| 将棋プレミアム | `SCRAPER_SHOGI_PREMIUM_ENABLED` | `/api/cron/scrape-shogi-premium` |
| 将棋DB2 | `SCRAPER_SHOGIDB2_ENABLED` | `/api/cron/scrape-shogidb2` |
| 将棋大会ナビ | `SCRAPER_SHOGI_TOURNAMENTS_ENABLED` | `/api/cron/scrape-shogi-tournaments` |
| アマ連盟 | `SCRAPER_SHOGI_AMAREN_ENABLED` | `/api/cron/scrape-shogi-amaren` |
| レーティングサイト | `SCRAPER_RATING_SITE_ENABLED` | `/api/cron/scrape-rating-site` |
| floodgate | `SCRAPER_FLOODGATE_ENABLED` | `/api/cron/scrape-floodgate` |
| ABEMA将棋 | (NG・有効化非推奨) | `/api/cron/scrape-abema` |

cron は Vercel の `vercel.json` に登録済み(または今後追加予定)。環境変数だけで ON/OFF できます。

---

## 📅 推奨タイムライン

### Phase 1 (連盟サイト復旧確認後)
1. 連盟サイト復旧を確認 (普通にブラウザで開けるか)
2. **将棋連盟LIVE中継** の規約確認 → OK なら有効化
3. **将棋連盟 公式** の規約確認 → OK なら有効化
4. 1週間運用してエラーが出ないか・データが取れているかを `/admin/scraper-status` で監視

### Phase 2 (1週間後・問題なければ)
5. **将棋連盟 棋士DB** を有効化
6. **将棋プレミアム** を有効化

### Phase 3 (個人運営サイトに連絡が取れたら)
7. **将棋DB2** 運営者にメール → 許可をもらえたら有効化
8. **将棋大会ナビ** 運営者にメール → 同上

### Phase 4 (任意)
9. アマ連盟 / レーティングサイト / floodgate を必要に応じて有効化

### 永久 OFF
10. **ABEMA将棋** は規約違反になるため、絶対に有効化しない

---

## ❓ よくある質問

### Q. 全部いっぺんに ON にしたら何か壊れる?
A. 規約違反になるサイトがあり (ABEMA等)、最悪サービス利用停止になる可能性あり。1つずつが安全。

### Q. 環境変数を入れたのに動かない
A. 「Redeploy」を忘れていないか確認。環境変数は新規デプロイ時に反映される。

### Q. 連盟サイトに迷惑をかけてないか心配
A. 各スクレイパーは内部で 1秒に1リクエスト以下のレート制限。User-Agent も明示。毎日 04:00 1回だけ。

### Q. 取れたデータがおかしい
A. `/admin/scraper-status` に最終取得時刻が出ます。手動で `/api/cron/<path>` を curl で叩いてレスポンスを確認できる(管理者用)。データが変なら環境変数を消して OFF に。

---

## 🔒 セキュリティメモ

- スクレイパーの cron は `CRON_SECRET` 環境変数で保護されています (設定する場合)
- 設定しない場合は誰でも叩けてしまうので、攻撃に耐えるよう Vercel 側でレート制限と一緒に運用してください
- Vercel Pro 以上なら DDoS 保護が自動で効きます
