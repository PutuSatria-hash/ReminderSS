import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const noteId = Number(id);
    const body = (await req.json()) as Record<string, unknown>;
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

    for (const key of ["title", "content", "category", "assignee_id"]) {
      if (key in body) {
        sets.push(`${key} = ?`);
        const val = body[key];
        values.push(val === null || val === "" ? null : String(val));
      }
    }
    if (typeof body.is_pinned === "boolean") {
      sets.push("is_pinned = ?");
      values.push(body.is_pinned ? 1 : 0);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
    }

    sets.push("updated_at = ?");
    values.push(nowIso());
    values.push(noteId);

    await query(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui catatan." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const noteId = Number(id);
    await query("DELETE FROM comments WHERE target_type = 'note' AND target_id = ?", [noteId]);
    await query("DELETE FROM note_checklists WHERE note_id = ?", [noteId]);
    await query("DELETE FROM notes WHERE id = ?", [noteId]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus catatan." },
      { status: 500 }
    );
  }
}
