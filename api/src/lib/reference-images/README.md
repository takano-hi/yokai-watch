# 参照画像

このディレクトリに次のPNGファイルを配置してください。

- `character.png`: キャラクター生成用の2枚目の画像
- `medal.png`: メダル生成用の2枚目の画像

パスは `../reference-images.ts` で管理します。環境変数の設定は不要です。
どちらかのファイルが存在しない、読み込めない、またはPNG形式でない場合、
生成APIはOpenAIを呼び出す前に500を返します。

ビルド後も `api/src/lib/reference-images` を配置してください。
APIのDockerfileでは `COPY src ./src` によって画像もコピーされます。
