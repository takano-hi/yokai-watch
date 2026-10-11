import { execSync } from "child_process";

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres@localhost:5433/test";
  if (new URL(url).pathname !== "/test") {
    throw new Error("テストDBの名前がtestでないため、リセットを中止しました");
  }
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
