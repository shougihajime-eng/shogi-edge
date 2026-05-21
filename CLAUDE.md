# Shogi Edge — 将棋勝敗予想アプリ

@AGENTS.md

Live 中継対象のプロ棋戦/アマ大会に絞った、データドリブン勝敗予想アプリ。
姉妹アプリ「将棋はじめあい」と同じく、棋士本人・将棋ファン・YouTuber を想定ユーザーに据えた本格データ予想ツール。

---

## 📍 進捗(いまここ)

### ✅ 直近で済んだこと (2026-05-22 自己学習・振り返り機能を完成)
- 雛形 (Next.js 16 + Tailwind v4 + App Router + TypeScript) + 共有 Supabase / `shogi_edge` スキーマ
- 7要素加重スコア予想エンジン + Claude API 一言サマリー + 信頼度★1〜5
- 全公開ページ + 管理画面 + シードデータ (棋士6名・デモ対局1件)
- GitHub 公開 + Vercel 本番デプロイ (https://shogi-edge.vercel.app)
- **【NEW】自己学習・振り返り機能 (仕様書 §9) 完成**:
  - 5新規テーブル: `match_reflections` / `weekly_reflections` / `monthly_reflections` / `weakness_patterns` / `backtest_results`
  - 対局結果確定 → 振り返り自動生成 (Claude or 事実ベースのフォールバック)
  - 7要素の答え合わせ (緑チェック/赤バツ) を対局詳細画面に表示
  - 弱点パターンDB 自動更新 → 同パターン予想時の信頼度を自動で下げる
  - 週次 cron (`/api/cron/weekly-reflection`) + 月次 cron (`/api/cron/monthly-reflection`)
  - 月次振り返りで重み調整提案を自動生成 → 承認すると weight_history に即適用
  - バックテスト (過去90日に新重みを当てた場合の的中率を再計算)
  - /accuracy に振り返りタイムライン + 重み変更履歴
  - YouTube 振り返り動画台本コピーボタン (今週の振り返り用)
- **【NEW】残り6サイト分のスクレイパー枠を OFF で追加** (将棋プレミアム / floodgate / レーティングサイト / 将棋大会ナビ / アマ連盟 / 棋士DB) = **計10サイト全部の枠が揃った**
- **【NEW】CSV 一括取込** (`/admin/import`) — 棋士 / 直接対戦

### 🟡 進行中
- Wikipedia 由来の直接対戦 112局を CSV 化済み・本番DB への貼り付け待ち
  - 出力先: `data/head_to_head_wikipedia.csv` (藤井聡太のタイトル戦・番勝負 2020〜2024年度)
  - 戦型(opening)・棋譜URL は Wikipedia 一覧に無いため空欄 (嘘ゼロルール)
  - 貼り付け先: https://shogi-edge.vercel.app/admin/import → 「直接対戦の一括取込」

### 🔜 次の一歩
1. ✅ `ANTHROPIC_API_KEY` は Vercel に登録済み (2026-05-22)。ローカル `.env.local` も `vercel env pull` で同期済み → Claude が「はじめ先生口調」で動作中
2. ✅ プロ棋士シードを 50 名に拡張済み (2026-05-22)。`/admin/players` で正しい段位に更新していく
3. ✅ 公知のタイトル戦 19局を本物の対戦データとして投入済み (棋聖戦・王位戦・叡王戦・竜王戦・名人戦・王座戦・棋王戦・王将戦 / 2020-2025)
4. 🟡 `data/head_to_head_wikipedia.csv` (112局) を `/admin/import` に貼り付け → 信頼度★が一気に上がる
5. 順位戦・他棋戦のタイトル戦データを追加取得 (現 CSV は藤井聡太絡みのみ)
6. 連盟サイト復旧 + 規約OK確認後に各スクレイパーを `enabled=true` にして順次 ON

### 🧰 メンテ用エンドポイント
- `POST /api/seed-demo` — ヘッダ `x-admin-password: <合言葉>` で叩くとシードを再投入できる(同じデータは upsert なので重複しない)

---

## 🌐 本番URL / 管理画面URL

- **本番**: https://shogi-edge.vercel.app
- **管理画面**: https://shogi-edge.vercel.app/admin/login
- **GitHub**: https://github.com/shougihajime-eng/shogi-edge (main 自動デプロイ)
- **Vercel Project**: shougihajime-3368s-projects/shogi-edge
- **合言葉(暫定)**: `hajime_edge_2026` (`.env.local` の `ADMIN_PASSWORD` で変更可)

> 合言葉は本人指示で覚えやすい単語に変更推奨。`.env.local` と Vercel 環境変数を両方書き換えること。

---

## 🛠 技術構成

- **フロント**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **DB**: 共有 Supabase / スキーマ `shogi_edge` (他プロジェクトのスキーマには触らない)
  - URL: `https://eqkaaohdbqefuszxwqzr.supabase.co`
  - Exposed schemas に `shogi_edge` 追加済み (PostgREST 経由 / Management API)
- **認証**: 管理画面のみ。`ADMIN_PASSWORD` を Cookie でハッシュ照合 (簡易共有秘密モデル)
- **LLM**: Anthropic Claude (`claude-haiku-4-5`) で一言サマリー生成
- **デプロイ**: Vercel (GitHub main 自動デプロイ予定)
- **チャート**: Recharts (戦型分布)

---

## 📚 主要ドキュメント

| 用途 | パス |
|---|---|
| 仕様書概要・コア要件 | `CLAUDE.md` (この文書) |
| Next.js 16 公式ガイド | `node_modules/next/dist/docs/01-app/...` (重要破壊変更あり) |
| 予想エンジン本体 | `src/lib/prediction/engine.ts` |
| 予想生成パイプ | `src/lib/prediction/repository.ts` |
| Claude 要約 | `src/lib/llm/summary.ts` (はじめ先生口調) |
| **振り返りエンジン** | `src/lib/reflection/engine.ts` (対局単位) |
| **週次/月次集計** | `src/lib/reflection/aggregate.ts` |
| **弱点パターン DB** | `src/lib/reflection/weakness.ts` |
| **YouTube 台本** | `src/lib/reflection/youtube.ts` |
| **バックテスト** | `src/lib/backtest.ts` |
| 認証 | `src/lib/auth/admin.ts` |
| DB スキーマ (基本) | `supabase/migrations/0001_init.sql` |
| **DB スキーマ (振り返り)** | `supabase/migrations/0002_reflections.sql` |
| Server Actions | `src/app/admin/actions.ts` |
| マイグレーション適用 | `node scripts/apply-migration.mjs` (SUPABASE_ACCESS_TOKEN 環境変数が必要) |

---

## 🧮 予想エンジン仕様(7要素加重)

| 要素 | 重み(初期) | 概要 |
|---|---:|---|
| レーティング差 | 0.30 | 独自イロレーティング |
| 直近1ヶ月成績差 | 0.20 | player_stats から |
| 直接対戦成績 | 0.15 | head_to_head 通算 |
| 戦型相性 | 0.15 | 想定戦型 × 相手の戦型別勝率 |
| 手番 (先後) | 0.08 | 先手後手別勝率 |
| 棋戦・持ち時間 | 0.07 | 直近1年勝率を代用 |
| 連勝/連敗 | 0.05 | current_streak |

- 出力: `win_prob_a/b`, `confidence` (★1〜5), `reasoning_json[]`, `expected_openings`
- **データなしの要素は impact = 0**。推測で数字を作らない (memory: 推測禁止)
- 重みは `weight_history` テーブルから外部注入。`/admin/weights` で変更可能

---

## 🚀 検証コマンド

```bash
# 開発サーバ
npm run dev

# 型チェック
npx tsc --noEmit

# プロダクションビルド
npm run build

# DB マイグレーション適用 (新しい .sql を作ったとき)
SUPABASE_ACCESS_TOKEN="sbp_xxx" node scripts/apply-migration.mjs

# Vercel に公開
vercel --prod
```

---

## 🚫 やってはいけないこと

- **shogi.or.jp / live.shogi.or.jp の自動取得**(規約未確認 + 現在サーバ攻撃で不安定。手動入力ファーストで運用すること)
- ABEMA の番組表スクレイピング(規約上 OFF 推奨)
- 将棋DB2 / 将棋大会ナビへの事前連絡なし自動アクセス
- `SUPABASE_SERVICE_ROLE_KEY` の git コミット
- 他プロジェクトのスキーマ(`shogi_hajime_ai` 等)への書き込み
- 棋士名の漢字ミス(特に中村太地八段) — 連盟公式表記を絶対正

---

## 📦 環境変数 (.env.local)

| 変数 | 用途 | 必須 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開鍵 (ブラウザに配布される) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理画面の書き込み用 (サーバのみ) | ✅ |
| `ANTHROPIC_API_KEY` | Claude 一言サマリー生成 | ⭕ (未設定でもフォールバック動作) |
| `ADMIN_PASSWORD` | 管理画面の合言葉 | ✅ |
| `CRON_SECRET` | B層スクレイパー有効化時のみ | — |

`.env.local.example` をコピーして `.env.local` を作成。Vercel ダッシュボードでも同じ変数を Production / Preview / Development に登録すること。

---

## 🗂 主要ディレクトリ

```
src/
├── app/
│   ├── page.tsx              トップ (今週のLive対局)
│   ├── match/[id]/page.tsx   対局詳細(予想/根拠/直接対戦/戦型/YouTube道具)
│   ├── players/...           棋士一覧/プロフィール
│   ├── amateurs/...          アマ選手
│   ├── accuracy/page.tsx     予想精度トラッキング
│   ├── tournaments-amateur/  アマ大会日程
│   ├── admin/
│   │   ├── login/            合言葉ログイン
│   │   ├── (authed)/         認証必須ゾーン (route group)
│   │   │   ├── page.tsx      ダッシュボード
│   │   │   ├── players/      棋士 CRUD
│   │   │   ├── matches/      対局 CRUD + 予想生成ボタン
│   │   │   ├── head-to-head/ 直接対戦登録
│   │   │   ├── player-stats/ 成績入力
│   │   │   ├── results/      終局結果確定
│   │   │   ├── weights/      重みチューニング + 履歴
│   │   │   ├── amateurs/     アマ選手登録
│   │   │   └── scraper-status/ B層ON/OFF状況
│   │   └── actions.ts        全 Server Actions
│   └── api/
│       └── cron/             B層スクレイパー (全 OFF)
├── components/
│   ├── PageShell.tsx         ヘッダー+フッター付き共通シェル
│   ├── MatchCard.tsx         対局カード(プロ/アマ共通)
│   ├── ReasoningList.tsx     7要素の根拠折りたたみ表示
│   ├── ProbabilityBar.tsx    勝率バー (朱 vs 藍)
│   ├── ConfidenceStars.tsx   信頼度★1〜5
│   ├── OpeningDistribution.tsx 戦型分布円グラフ
│   ├── HeadToHeadList.tsx    直接対戦履歴
│   ├── YouTubeTools.tsx      台本コピー + サムネ用5パターン
│   └── PlayerStatsPanel.tsx  棋士情報パネル(両側)
├── lib/
│   ├── prediction/{engine, repository}.ts
│   ├── llm/summary.ts
│   ├── auth/admin.ts
│   ├── supabase/{client, admin}.ts
│   └── utils.ts
└── types/db.ts               スキーマ型定義 (手書き)
```
