# Shogi Edge — 将棋勝敗予想アプリ

@AGENTS.md

Live 中継対象のプロ棋戦/アマ大会に絞った、データドリブン勝敗予想アプリ。
姉妹アプリ「将棋はじめあい」と同じく、棋士本人・将棋ファン・YouTuber を想定ユーザーに据えた本格データ予想ツール。

---

## 📍 進捗(いまここ)

### ✅ 直近で済んだこと (2026-05-22 立ち上げ完走)
- 雛形 (Next.js 16 + Tailwind v4 + App Router + TypeScript) を生成
- 共有 Supabase に `shogi_edge` スキーマと 11 テーブル + RLS + 初期重み を作成
- 7要素加重スコア予想エンジン + Claude API 一言サマリー + 信頼度★1〜5 ロジック実装
- 全公開ページ(トップ / 対局詳細 / 棋士 / アマ / 精度 / アマ大会 / 404) 実装
- 管理画面(合言葉ログイン / 棋士 CRUD / 成績 / 戦型 / 直接対戦 / 対局 / 結果確定 / 重み / アマ / 自動取得状況)実装
- B層スクレイパー(連盟・LIVE・ABEMA・将棋DB2)は **全 OFF** で枠だけ用意
- デザインシステム(墨×和紙×朱×藍×金茶 / 明朝×等幅) 確立
- TypeScript 型チェック / next build 成功

### 🟡 進行中
- (なし)

### 🔜 次の一歩
1. GitHub に push、Vercel に公開 (本人の最初の起動確認)
2. 棋士データ・直近成績・直接対戦の手動投入 (10〜20名程度から)
3. 連盟サイト復旧 + 規約OK確認後に B層を 1 サイトずつ ON

---

## 🌐 本番URL / 管理画面URL

- **本番**: (未デプロイ) — Vercel 公開後にここを更新
- **管理画面**: (本番URL)/admin/login
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
| 認証 | `src/lib/auth/admin.ts` |
| DB スキーマ | `supabase/migrations/0001_init.sql` |
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
