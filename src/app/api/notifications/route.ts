import { NextResponse } from "next/server";
import { getDashboardBootstrap, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: number; mark_all?: boolean };
    if (body.mark_all) {
      await query("UPDATE notifications SET is_read = 1");
    } else if (typeof body.id === "number") {
      await query("UPDATE notifications SET is_read = 1 WHERE id = ?", [body.id]);
    }
    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui notifikasi." },
      { status: 500 }
    );
  }
}
