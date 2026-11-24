import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = Number(id);
    if (!Number.isFinite(taskId)) {
      return NextResponse.json({ error: "ID task tidak valid." }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "title",
      "description",
      "assignee_id",
      "status",
      "priority",
      "category",
      "due_date",
      "code",
    ];
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        const val = body[key];
        values.push(val === null || val === "" ? null : String(val));
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    sets.push("updated_at = ?");
    values.push(nowIso());
    values.push(taskId);

    await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui tugas." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const taskId = Number(id);
    await query("DELETE FROM comments WHERE target_type = 'task' AND target_id = ?", [taskId]);
    await query("DELETE FROM task_checklists WHERE task_id = ?", [taskId]);
    await query("DELETE FROM tasks WHERE id = ?", [taskId]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus tugas." },
      { status: 500 }
    );
  }
}
