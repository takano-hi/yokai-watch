import type { Monster } from "@/lib/api";

const SEED: Monster[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "テストの妖怪",
    imageFilename: "mock-monster.svg",
    bookId: null,
    medalFilename: "mock-medal.svg",
    description: "開発用のサンプルデータです",
    skill: "",
    personality: "",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "サンプル太郎",
    imageFilename: "mock-monster.svg",
    bookId: null,
    medalFilename: "mock-medal.svg",
    description: null,
    skill: "",
    personality: "",
  },
];

export const db = new Map<string, Monster>(SEED.map((m) => [m.id, m]));
