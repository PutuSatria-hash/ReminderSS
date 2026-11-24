import { NextResponse } from "next/server";
import { getDashboardBootstrap, nowIso, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title: string;
      content?: string;
      category?: string;
      author_id?: string;
      assignee_id?: string | null;
      is_pinned?: boolean;
      checklists?: Array<{ label: string; assignee_id?: string | null }>;
    };

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Judul catatan wajib diisi." }, { status: 400 });
    }

    const now = nowIso();
    const res = await query(
      `INSERT INTO notes (title, content, category, author_id, assignee_id, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        title,
        (body.content || "").trim(),
        body.category || "checklist",
        body.author_id || "boss",
        body.assignee_id || null,
        body.is_pinned ? 1 : 0,
        now,
        now,
      ]
    );

    const noteId = Number(res.lastInsertRowid);
    if (Array.isArray(body.checklists) && body.checklists.length > 0) {
      const items = body.checklists.filter((c) => c.label && c.label.trim());
      for (let idx = 0; idx < items.length; idx++) {
        await query(
          `INSERT INTO note_checklists (note_id, label, assignee_id, is_done, checked_by, checked_at, sort_order)
           VALUES (?, ?, ?, 0, NULL, NULL, ?)`,
          [noteId, items[idx].label.trim(), items[idx].assignee_id || null, idx]
        );
      }
    }

    return NextResponse.json({ id: noteId, data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat catatan." },
      { status: 500 }
    );
  }
}
