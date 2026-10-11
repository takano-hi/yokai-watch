import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mock-db";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const monster = db.get(id);
  if (!monster) {
    return NextResponse.json(
      { success: false, message: "妖怪が見つかりません" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(monster, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const monster = db.get(id);
  if (!monster) {
    return NextResponse.json(
      { success: false, message: "妖怪が見つかりません" },
      { status: 404 }
    );
  }

  const body = await req.json();
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { success: false, message: "name は必須です" },
      { status: 400 }
    );
  }

  const updated = { ...monster, name: body.name };
  db.set(id, updated);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  if (!db.has(id)) {
    return NextResponse.json(
      { success: false, message: "妖怪が見つかりません" },
      { status: 404 }
    );
  }

  db.delete(id);
  return new NextResponse(null, { status: 204 });
}
