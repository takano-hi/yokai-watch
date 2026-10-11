const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const R2_BASE_URL = (process.env.NEXT_PUBLIC_R2_BASE_URL ?? "").replace(/\/+$/, "");

export type Monster = {
  id: string;
  name: string;
  imageFilename: string;
  bookId: string | null;
  medalFilename: string | null;
  skill: string;
  personality: string;
  description: string | null;
};

type PostMonsterResponse =
  | { success: true; monster: Monster; imageUrl: string; medalUrl: string | null }
  | { success: false; message: string };

export async function getMonsters(): Promise<Monster[]> {
  const res = await fetch(`${BASE_URL}/monsters`);
  if (!res.ok) throw new Error("妖怪一覧を取得できませんでした");

  const monsters: unknown = await res.json();
  return Array.isArray(monsters) ? monsters as Monster[] : [];
}

export function getMonsterImageUrl(filename: string | null): string | null {
  if (!filename) return null;
  if (/^(?:https?:)?\/\//.test(filename) || filename.startsWith("data:")) return filename;

  const key = filename.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return R2_BASE_URL ? `${R2_BASE_URL}/${key}` : `/${key}`;
}

export function getMedalImageUrl(medalFilename: string): string {
  return getMonsterImageUrl(medalFilename) ?? `/${medalFilename}`;
}

export async function postMonster(
  name: string,
  file: File,
  skill = "",
  personality = "",
  signal?: AbortSignal,
): Promise<PostMonsterResponse> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("photo", file);
  formData.append("skill", skill);
  formData.append("personality", personality);

  const res = await fetch(`${BASE_URL}/monsters`, {
    method: "POST",
    body: formData,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { success: false, message: data?.message ?? "送信に失敗しました" };
  }

  if (res.status !== 202) return { success: false, message: "受付応答が正しくありません" };
  const accepted: unknown = await res.json();
  if (!accepted || typeof accepted !== "object" || !("id" in accepted) ||
      typeof accepted.id !== "string" || !("status" in accepted) || accepted.status !== "processing") {
    return { success: false, message: "受付応答が正しくありません" };
  }
  const deadline = Date.now() + 330_000;
  let monster: Monster | undefined;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(Math.min(10_000, deadline - Date.now()));
    const response = await fetch(`${BASE_URL}/monsters/${encodeURIComponent(accepted.id)}`, {
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (response.status === 200) {
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("id" in result) || result.id !== accepted.id ||
          !("imageFilename" in result) || typeof result.imageFilename !== "string" ||
          !("medalFilename" in result) || (result.medalFilename !== null && typeof result.medalFilename !== "string")) {
        return { success: false, message: "登録結果の応答が正しくありません" };
      }
      monster = result as Monster;
      break;
    }
    if (response.status !== 404) return { success: false, message: "登録結果を確認できませんでした" };
    await waitForPoll(Math.min(3_000, Math.max(0, deadline - Date.now())), signal);
  }
  if (!monster) return { success: false, message: "時間内に登録を確認できませんでした" };
  return {
    success: true,
    monster,
    imageUrl: getMonsterImageUrl(monster.imageFilename) ?? "",
    medalUrl: getMonsterImageUrl(monster.medalFilename),
  };
}

function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
