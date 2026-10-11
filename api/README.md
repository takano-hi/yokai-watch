# API

Express・Prisma・PostgreSQLで妖怪を管理します。`POST /monsters`は写真を受け付けると202と登録予定のIDを返し、その後に同じプロセスでVercel APIを呼び出します。画像生成・R2保存の成功結果を受け取ってからDBに登録します。

## 設定

`.env-sample`に設定項目を記載しています。HerokuではConfig Varsに次を設定してください。

- `DATABASE_URL`: 既存DB。
- `IMAGE_GENERATION_API_URL`: `https://<project>.vercel.app/api/generations`。
- `IMAGE_GENERATION_API_TOKEN`: Vercelと共通のAPI用トークン。
- `VERCEL_AUTOMATION_BYPASS_SECRET`: Deployment Protectionを使う場合だけ設定。

画像生成用のOpenAI・R2認証情報はVercel側に設定します。

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

テストはOpenAI・R2・Vercelへの通信をモックします。DBリセット先は`TEST_DATABASE_URL`の`test`データベースに限定します。

途中失敗・プロセス再起動時の復旧や自動再試行はありません。失敗時はID・段階・エラー種別をログに残します。生成済み画像だけR2に残ることがあります。

詳細は[仕様書](../docs/image-generation-deferred-registration.md)を参照してください。
