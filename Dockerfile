FROM node:24-alpine

WORKDIR /app

# 依存パッケージをインストール
COPY web/package*.json ./
RUN npm ci

EXPOSE 3000

# Windowsでのファイル変更検知を優先
CMD ["npm", "run", "dev", "--", "--webpack", "--hostname", "0.0.0.0"]
