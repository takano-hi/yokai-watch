# yoka-watch — AI エージェント向けガイド

写真から妖怪キャラクターとメダル画像を生成し、図鑑に登録するアプリ。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `api/` | Express + Prisma(PostgreSQL) + Cloudflare R2。画像生成は OpenAI Images API |
| `web/` | Next.js 16 / React 19 / Tailwind 4。`web/AGENTS.md` も必ず読むこと |
| `web/src/app/api/` | API サーバーのモック（`npm run dev:mock` 用）。`web/src/lib/mock-db.ts` がデータ |
| `docs/` | 設計メモ。新機能は設計を書いてから実装する |

API 契約は 3 か所に分散している。**API を変えたら全部揃えること**:
1. `api/src/routes/*.ts`（実装）と `api/openapi.json`（仕様）
2. `web/src/lib/api.ts`（クライアントと型）
3. `web/src/app/api/**` と `web/src/lib/mock-db.ts`（モック）

## 開発環境

ホストに Node.js は無い。**すべて docker compose のコンテナ内で実行する**（`docker compose up -d` で起動済みの前提）。

| 目的 | コマンド |
|---|---|
| API 型チェック | `docker compose exec -T api npx tsc --noEmit` |
| API テスト | `docker compose exec -T api npm test` |
| Web 型チェック | `docker compose exec -T web npx tsc --noEmit` |
| Web lint | `docker compose exec -T web npm run lint` |
| ログ | `docker compose logs --tail=100 api` |
| 全チェック | `bash .claude/hooks/quality-gate.sh --all` |

- API は `http://localhost:3001`、Web は `http://localhost:3000`
- `api/src`, `api/prisma`, `web/src`, `web/public` はボリュームマウント済み。`package.json` を変えた場合はイメージの再ビルドが必要（人に依頼する）

## 規約

- **DB スキーマ変更**: `api/prisma/schema.prisma` を編集し、`api/prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` を追加する。本番は `prisma migrate deploy` で適用される
- **テスト**: API のルートを変えたら `api/src/routes/*.test.ts` を追加・更新する。テスト DB は毎回リセットされる
- **OpenAI / R2 をテストから実際に呼ばない**（課金・外部書き込みになる）。必ずモックする
- 型は `any` を避ける。UI 文言は日本語
- コミットメッセージは日本語・英語どちらでも可。1 コミット 1 目的

## 禁止事項

- `.env` の読み書き（`.env-sample` は可）
- `git push`（人が行う。main への push は Heroku に自動デプロイされる）
- `prisma migrate reset` / `db push --force-reset` を開発 DB に対して実行すること
- 既存の migration ファイルの書き換え

## 完了の定義

1. 変更した領域の型チェック・テスト・lint がすべて通る（`quality-gate.sh` が exit 0）
2. API 契約の 3 か所が揃っている
3. 変更内容・確認したこと・未確認のことを日本語で報告する

## 作業フロー（Claude Code では `/implement`）

1. 計画: 要件 → 影響範囲 → 変更方針。大きい場合は `docs/` に設計を書く
2. ブランチ: `git switch -c feat/<topic>`（main では作業しない）
3. 実装: api → web の順（契約を先に固める）
4. 検証: 完了の定義を満たすまで修正
5. レビュー: 差分をバグ・契約ずれ・セキュリティの観点で見直す
6. コミットして報告（push はしない）
