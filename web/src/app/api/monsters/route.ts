import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mock-db";

export async function GET() {
  const monsters = [...db.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ja")
  );
  return NextResponse.json(monsters);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get("name");
  const photo = formData.get("photo");

  if (!name || !photo) {
    return NextResponse.json(
      { success: false, message: "name と photo は必須です" },
      { status: 400 }
    );
  }

  await new Promise((r) => setTimeout(r, 800));

  const monster = {
    id: crypto.randomUUID(),
    name: name as string,
    imageFilename: "mock-monster.svg",
    bookId: null,
    medalFilename: "mock-medal.svg",
    description: null,
    skill: "",
    personality: "",
  };

  db.set(monster.id, monster);

  return NextResponse.json(monster, { status: 201 });
}
