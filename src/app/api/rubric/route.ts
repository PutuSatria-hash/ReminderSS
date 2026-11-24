import { NextResponse } from "next/server";
import { getDashboardBootstrap, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id: number; is_done?: boolean; notes?: string };
    if (typeof body.is_done === "boolean") {
      await query("UPDATE rubric_items SET is_done = ? WHERE id = ?", [
        body.is_done ? 1 : 0,
        body.id,
      ]);
    }
    if (typeof body.notes === "string") {
      await query("UPDATE rubric_items SET notes = ? WHERE id = ?", [body.notes, body.id]);
    }
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui rubrik." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { section: string; title: string; owner_id?: string };
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Item rubrik wajib diisi." }, { status: 400 });
    }
    const maxRes = await query("SELECT COALESCE(MAX(sort_order), -1) as m FROM rubric_items");
    const nextOrder = Number(maxRes.rows[0]?.m ?? -1) + 1;
    await query(
      "INSERT INTO rubric_items (section, title, owner_id, is_done, notes, sort_order) VALUES (?, ?, ?, 0, '', ?)",
      [body.section || "Fitur Tambahan", title, body.owner_id || "boss", nextOrder]
    );
    return NextResponse.json({ data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menambah rubrik." },
      { status: 500 }
    );
  }
}
