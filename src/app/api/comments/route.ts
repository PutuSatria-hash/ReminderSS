import { NextResponse } from "next/server";
import {
  addNotification,
  dispatchDiscordNotification,
  getDashboardBootstrap,
  nowIso,
  query,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      target_type: "task" | "note";
      target_id: number;
      author_id: string;
      body: string;
      kind?: string;
    };

    const text = (body.body || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Komentar tidak boleh kosong." }, { status: 400 });
    }

    const now = nowIso();
    const kind = body.kind || "comment";
    const authorId = body.author_id || "boss";

    await query(
      `INSERT INTO comments (target_type, target_id, author_id, body, kind, is_resolved, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [body.target_type, body.target_id, authorId, text, kind, now]
    );

    if (kind === "question" || kind === "blocker") {
      const mRes = await query("SELECT name FROM members WHERE id = ?", [authorId]);
      const authorName = mRes.rows[0]?.[0] ? String(mRes.rows[0][0]) : authorId;

      let refLabel = "";
      if (body.target_type === "task") {
        const tRes = await query("SELECT code, title FROM tasks WHERE id = ?", [body.target_id]);
        refLabel = tRes.rows[0]
          ? `[${String(tRes.rows[0][0])}] ${String(tRes.rows[0][1])}`
          : `Task #${body.target_id}`;
      } else {
        const nRes = await query("SELECT title FROM notes WHERE id = ?", [body.target_id]);
        refLabel = nRes.rows[0] ? String(nRes.rows[0][0]) : `Catatan #${body.target_id}`;
      }

      const notifTitle =
        kind === "blocker"
          ? `Kendala dilaporkan oleh ${authorName}`
          : `Pertanyaan baru dari ${authorName}`;

      await addNotification({
        kind: "question",
        title: notifTitle,
        message: `${refLabel}: "${text.slice(0, 120)}"`,
        link_tab: body.target_type === "task" ? "tasks" : "notes",
        ref_id: String(body.target_id),
      });

      await dispatchDiscordNotification(notifTitle, `**${refLabel}**\n${text}`);
    }

    return NextResponse.json({ data: await getDashboardBootstrap() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengirim komentar." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id: number; is_resolved: boolean };
    await query("UPDATE comments SET is_resolved = ? WHERE id = ?", [
      body.is_resolved ? 1 : 0,
      body.id,
    ]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui status komentar." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    await query("DELETE FROM comments WHERE id = ?", [id]);
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus komentar." },
      { status: 500 }
    );
  }
}
