# YouTube制限ビューア

YouTube Shorts やレコメンドに引きずられた長時間視聴を防ぐための **個人用Webアプリ**。
登録チャンネルの中から自分が選んだチャンネルだけを対象に、**1チャンネルにつき1日1本** の動画を提示し、アプリ内の埋め込みプレイヤーで視聴を完結させます。

## 特徴

- 🎯 **1チャンネル × 1日 = 1本だけ** の動画を提示（同じ動画は何度でも視聴可能）
- 🚫 **YouTube Shorts を完全除外**（60秒以下の動画は候補から除外）
- 🔁 **新着優先 → なければ過去動画からランダム**
  - 「新着」= 前回アプリを使った日以降に投稿された動画
- 📺 **YouTubeページに遷移しない** iframe 埋め込みプレイヤー
- 🔒 **自分のYouTube購読チャンネルだけ** がスコープ（OAuthで読み取り権限のみ）
- 💸 **完全無料運用**（Vercel + Supabase + YouTube Data API の無料枠で完結）

## 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| 認証 | NextAuth v5 (Google OAuth, JWT セッション) |
| DB | Supabase (PostgreSQL) |
| スタイリング | Tailwind CSS |
| ホスティング | Vercel |
| 外部API | YouTube Data API v3 |

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/IwatsukaYura/youtube-restrict-app.git
cd youtube-restrict-app
npm install
```

### 2. Google Cloud Console の準備

1. https://console.cloud.google.com/ で新規プロジェクト作成
2. 「APIとサービス」→「ライブラリ」→ **YouTube Data API v3** を有効化
3. 「OAuth同意画面」を設定:
   - User Type: **外部**
   - スコープに `https://www.googleapis.com/auth/youtube.readonly` を追加
   - テストユーザーに自分のGmailを登録
4. 「認証情報」→「OAuthクライアントID」→ **ウェブアプリケーション** を作成
   - 承認済みリダイレクトURI: `http://localhost:3000/api/auth/callback/google`
5. クライアントID と クライアントシークレットを控える

### 3. Supabase の準備

1. https://supabase.com/ でプロジェクト作成（Free プラン）
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` の中身を実行
3. 「Project Settings」→「Data API」→ **Project URL** を控える
4. 「Project Settings」→「API Keys」→ **Legacy** タブから:
   - `anon public` キー
   - `service_role secret` キー
   をそれぞれ控える

### 4. 環境変数を設定

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

次の値を入力:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=  # openssl rand -base64 32 で生成
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 5. 開発サーバーを起動

```bash
npm run dev
```

http://localhost:3000 にアクセス。

## 使い方

1. **ログイン**: Googleアカウントで認証（YouTube読み取り権限のみ）
2. **チャンネル設定** (`/channels`): 「チャンネルを同期」→ 視聴対象チャンネルにチェック → 「変更を保存」
3. **トップページ** (`/`): 当日の推薦動画が表示される → 「再生」でモーダル内視聴

## 動画選択アルゴリズム

各選択チャンネルについて、以下のロジックで毎日1本決定:

```
1. 当日分が既にDBにあれば → そのまま固定で返す
2. なければ直近50本の動画を取得し、Shorts(60秒以下)を除外
3. 「前回利用日以降に投稿された動画」があれば → 最新の1本を提示
4. 新着がなければ → 残りの動画からランダムに1本を提示
5. 結果を daily_picks テーブルに記録（同日中はリロードしても同じ）
```

## ディレクトリ構成

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth ハンドラ
│   │   ├── channels/            # チャンネル取得・更新・同期
│   │   └── picks/               # 当日の推薦動画取得
│   ├── channels/page.tsx        # チャンネル設定画面
│   ├── login/page.tsx           # ログイン画面
│   └── page.tsx                 # トップ（動画一覧）
├── auth.ts                      # NextAuth設定
├── middleware.ts                # 未認証リダイレクト
├── components/                  # UI コンポーネント
├── lib/
│   ├── youtube.ts               # YouTube API ラッパー
│   ├── picks.ts                 # 推薦アルゴリズム
│   └── supabase.ts              # Supabase クライアント
└── types/                       # 型定義
supabase/
└── migrations/                  # DBスキーマ
```

## YouTube API クォータ

無料枠 10,000 units/日 に対し、本アプリの想定消費量:

| 操作 | コスト |
|------|--------|
| 購読チャンネル取得（100件） | 〜2 units |
| 日次推薦生成（10チャンネル） | 〜20 units |

通常利用で枯渇する心配はありません。

## ライセンス

MIT
