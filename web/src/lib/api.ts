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
  skill: string,
  personality: string,
): Promise<PostMonsterResponse> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("photo", file);

  const res = await fetch(`${BASE_URL}/monsters`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json();
    return { success: false, message: data.message ?? "送信に失敗しました" };
  }

  const monster: Monster = await res.json();
  return {
    success: true,
    monster,
    imageUrl: getMonsterImageUrl(monster.imageFilename) ?? "",
    medalUrl: getMonsterImageUrl(monster.medalFilename),
  };
}
