import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function generateNextCode(prefix: string): Promise<string> {
  const res = await query("SELECT code FROM tasks WHERE code LIKE ?", [`${prefix}-%`]);
  let maxNum = 0;
  for (const r of res.rows) {
    const num = Number(String(r[0]).split("-")[1]);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return `${prefix}-${String(maxNum + 1).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      code?: string;
      title: string;
      description?: string;
      assignee_id?: string;
      status?: string;
      priority?: string;
      category?: string;
      due_date?: string | null;
      checklists?: string[];
    };

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
    }

    const assigneeId = body.assignee_id || "yoga";
    const category =
      body.category ||
      (assigneeId === "yoga" ? "backend" : assigneeId === "juli" ? "frontend" : "management");
    const defaultPrefix = assigneeId === "yoga" ? "BE" : assigneeId === "juli" ? "FE" : "PM";
    const code = (body.code || "").trim().toUpperCase() || (await generateNextCode(defaultPrefix));

    const now = nowIso();
    const res = await query(
      `INSERT INTO tasks (code, title, description, assignee_id, status, priority, category, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        title,
        (body.description || "").trim(),
        assigneeId,
        body.status || "todo",
        body.priority || "medium",
        category,
        body.due_date || null,
        now,
        now,
      ]
    );

    const taskId = Number(res.lastInsertRowid);
    if (Array.isArray(body.checklists) && body.checklists.length > 0) {
      const items = body.checklists.map((c) => c.trim()).filter(Boolean);
      for (let idx = 0; idx < items.length; idx++) {
        await query(
          "INSERT INTO task_checklists (task_id, label, is_done, sort_order) VALUES (?, ?, 0, ?)",
          [taskId, items[idx], idx]
        );
      }
    }

    return NextResponse.json({ id: taskId, code, data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat tugas." },
      { status: 500 }
    );
  }
}
