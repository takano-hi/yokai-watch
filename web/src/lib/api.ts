const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL ?? "";

export type Monster = {
  id: string;
  name: string;
  imageFilename: string;
  bookId: string | null;
  medalFilename: string | null;
  description: string | null;
};

type PostMonsterResponse =
  | { success: true; monster: Monster; imageUrl: string; medalUrl: string | null }
  | { success: false; message: string };

export async function getMonsters(): Promise<Monster[]> {
  const res = await fetch(`${BASE_URL}/monsters`);
  if (!res.ok) return [];
  return res.json();
}

export function getMedalImageUrl(medalFilename: string): string {
  return `${R2_BASE_URL}/${medalFilename}`;
}

export async function postMonster(
  name: string,
  file: File
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
    imageUrl: `${R2_BASE_URL}/${monster.imageFilename}`,
    medalUrl: monster.medalFilename
      ? `${R2_BASE_URL}/${monster.medalFilename}`
      : null,
  };
}
