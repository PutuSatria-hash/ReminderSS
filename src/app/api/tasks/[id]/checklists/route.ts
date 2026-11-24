import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = Number(id);
    const body = (await req.json()) as { label: string };
    const label = (body.label || "").trim();
    if (!label) {
      return NextResponse.json({ error: "Isi checklist wajib diisi." }, { status: 400 });
    }

    const maxRes = await query(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM task_checklists WHERE task_id = ?",
      [taskId]
    );
    const nextOrder = Number(maxRes.rows[0]?.m ?? -1) + 1;

    await query(
      "INSERT INTO task_checklists (task_id, label, is_done, sort_order) VALUES (?, ?, 0, ?)",
      [taskId, label, nextOrder]
    );
    await query("UPDATE tasks SET updated_at = ? WHERE id = ?", [nowIso(), taskId]);

    return NextResponse.json({ data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menambah checklist." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = Number(id);
    const body = (await req.json()) as { checklist_id: number; is_done?: boolean; label?: string };

    if (typeof body.is_done === "boolean") {
      await query("UPDATE task_checklists SET is_done = ? WHERE id = ? AND task_id = ?", [
        body.is_done ? 1 : 0,
        body.checklist_id,
        taskId,
      ]);
    }
    if (typeof body.label === "string" && body.label.trim()) {
      await query("UPDATE task_checklists SET label = ? WHERE id = ? AND task_id = ?", [
        body.label.trim(),
        body.checklist_id,
        taskId,
      ]);
    }
    await query("UPDATE tasks SET updated_at = ? WHERE id = ?", [nowIso(), taskId]);

    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengubah checklist." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = Number(id);
    const { searchParams } = new URL(req.url);
    const checklistId = Number(searchParams.get("checklistId"));
    await query("DELETE FROM task_checklists WHERE id = ? AND task_id = ?", [checklistId, taskId]);
    await query("UPDATE tasks SET updated_at = ? WHERE id = ?", [nowIso(), taskId]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus checklist." },
      { status: 500 }
    );
  }
}
