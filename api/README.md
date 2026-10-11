# API

Express・Prisma・PostgreSQLで妖怪を管理します。`POST /monsters`は写真を受け付けると202と登録予定のIDを返し、その後に同じHerokuプロセスでOpenAIの画像生成とR2保存を実行し、保存完了後にDBに登録します。

## 設定

`.env-sample`に設定項目を記載しています。HerokuではConfig Varsに次を設定してください。

- `DATABASE_URL`: 既存DB。
- `CHATGPT_API_KEY`: 既存のOpenAI APIキー。
- `CLOUDFLARE_R2_API_ENDPOINT`、`CLOUDFLARE_R2_ACCESS_KEY_ID`、`CLOUDFLARE_R2_SECRET_ACCESS_KEY`、`CLOUDFLARE_R2_BUCKET_NAME`: 既存のR2設定。

環境変数の読み込み方法は従来どおりです。Docker Composeは`api/.env`を読み、単体起動は`dotenv/config`を使用します。Vercel接続URL・API用トークンの追加やWeb側への認証情報の移設は不要です。

## 呼び出し例（PowerShell）

```powershell
$apiUrl = "https://<heroku-app>.herokuapp.com"
$accepted = curl.exe --fail-with-body --max-time 20 `
  "$apiUrl/monsters" `
  -F "name=demo" -F "photo=@photo.jpg" `
  -F "skill=running" -F "personality=shy" | ConvertFrom-Json

# 登録前は404。画像生成・R2保存・DB登録が完了すると200になる。
curl.exe --fail-with-body --max-time 10 "$apiUrl/monsters/$($accepted.id)"
```

写真はJPEG / PNGで最大4,000,000 bytes。202は受付を表し、DB登録はまだ行われていません。既存のGET・PATCH・DELETEを使用します。

## 検証

```bash
docker compose exec -T api npx tsc --noEmit
docker compose exec -T api npm test
docker compose exec -T api npm run build
```

テストはOpenAI・R2への通信をモックします。DBリセット先は`TEST_DATABASE_URL`の`test`データベースに限定します。

途中失敗・プロセス再起動時の復旧や自動再試行はありません。失敗時はID・段階・エラー種別をログに残します。生成済み画像だけR2に残ることがあります。

詳細は[仕様書](../docs/image-generation-deferred-registration.md)を参照してください。
