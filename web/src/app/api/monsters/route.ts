import { after, NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mock-db";
import { GenerationError, parseGenerationInput } from "@/lib/generation-input";

export async function GET() {
  const monsters = [...db.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ja")
  );
  return NextResponse.json(monsters);
}

export async function POST(req: NextRequest) {
  try {
    const { name, skill, personality } = await parseGenerationInput(await req.formData(), false);
    const id = crypto.randomUUID();
    const monster = {
      id,
      name,
      imageFilename: "mock-monster.svg",
      bookId: null,
      medalFilename: "mock-medal.svg",
      description: null,
      skill,
      personality,
    };
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      db.set(id, monster);
    });
    return NextResponse.json({ id, status: "processing" }, {
      status: 202, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof GenerationError ? error.message : "送信形式が正しくありません" }, {
      status: error instanceof GenerationError ? error.status : 400,
    });
  }
}
