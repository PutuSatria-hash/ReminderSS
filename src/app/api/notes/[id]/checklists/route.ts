import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const noteId = Number(id);
    const body = (await req.json()) as { label: string; assignee_id?: string | null };
    const label = (body.label || "").trim();
    if (!label) {
      return NextResponse.json({ error: "Item checklist wajib diisi." }, { status: 400 });
    }

    const maxRes = await query(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM note_checklists WHERE note_id = ?",
      [noteId]
    );
    const nextOrder = Number(maxRes.rows[0]?.[0] ?? -1) + 1;

    await query(
      `INSERT INTO note_checklists (note_id, label, assignee_id, is_done, checked_by, checked_at, sort_order)
       VALUES (?, ?, ?, 0, NULL, NULL, ?)`,
      [noteId, label, body.assignee_id || null, nextOrder]
    );
    await query("UPDATE notes SET updated_at = ? WHERE id = ?", [nowIso(), noteId]);

    return NextResponse.json({ data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menambah checklist catatan." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const noteId = Number(id);
    const body = (await req.json()) as {
      checklist_id: number;
      is_done?: boolean;
      checked_by?: string;
      label?: string;
      assignee_id?: string | null;
    };

    const now = nowIso();
    if (typeof body.is_done === "boolean") {
      await query(
        "UPDATE note_checklists SET is_done = ?, checked_by = ?, checked_at = ? WHERE id = ? AND note_id = ?",
        [
          body.is_done ? 1 : 0,
          body.is_done ? body.checked_by || "boss" : null,
          body.is_done ? now : null,
          body.checklist_id,
          noteId,
        ]
      );
    }
    if (typeof body.label === "string" && body.label.trim()) {
      await query("UPDATE note_checklists SET label = ? WHERE id = ? AND note_id = ?", [
        body.label.trim(),
        body.checklist_id,
        noteId,
      ]);
    }
    if ("assignee_id" in body) {
      await query("UPDATE note_checklists SET assignee_id = ? WHERE id = ? AND note_id = ?", [
        body.assignee_id || null,
        body.checklist_id,
        noteId,
      ]);
    }

    await query("UPDATE notes SET updated_at = ? WHERE id = ?", [now, noteId]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui checklist catatan." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const noteId = Number(id);
    const { searchParams } = new URL(req.url);
    const checklistId = Number(searchParams.get("checklistId"));
    await query("DELETE FROM note_checklists WHERE id = ? AND note_id = ?", [checklistId, noteId]);
    await query("UPDATE notes SET updated_at = ? WHERE id = ?", [nowIso(), noteId]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus checklist catatan." },
      { status: 500 }
    );
  }
}
