This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 環境変数

画像生成APIのデプロイでは、VercelのRoot Directoryを`web`、Fluid computeを有効に設定します。`POST /api/generations`は、OpenAIで画像を生成してR2へ保存してからHTTP 200を返す同期APIです。DB登録はHerokuが行います。

Vercelには`IMAGE_GENERATION_API_TOKEN`、`CHATGPT_API_KEY`と、`.env-sample`にある`CLOUDFLARE_R2_*`の4項目を設定してください。`OPENAI_IMAGE_MODEL`の初期値は`gpt-6-luna`です。これらの認証情報はサーバー専用です。

API・入力制限・curl例は[仕様書](../docs/image-generation-deferred-registration.md)に記載しています。生成APIを直接curlするとR2に保存されますが、DB登録は行われません。

Webの依存にR2 SDKとテスト用Vitestを追加しています。既存Docker環境ではWebイメージの再ビルドが必要です。

```bash
docker compose build web
docker compose up -d web
docker compose exec -T web npm test
docker compose exec -T web npx tsc --noEmit
docker compose exec -T web npm run lint
docker compose exec -T web npm run build
```

`.env-sample` をコピーして `.env` を作成し、各キーに値を設定してください。

```bash
cp .env-sample .env
```

| 変数名 | 説明 |
|---|---|
| `CHATGPT_API_KEY` | OpenAI API キー（Next.js ルートハンドラ経由で直接呼ぶ場合） |
| `NEXT_PUBLIC_API_URL` | API サーバーの URL（docker compose では自動設定） |

> `.env` は `.gitignore` に含まれています。`.env-sample` にはキー名のみ記載しており、git 管理対象です。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
