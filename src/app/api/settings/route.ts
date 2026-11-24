import { NextResponse } from "next/server";
import { getDashboardBootstrap, query, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      project_name?: string;
      github_repo?: string;
      github_branch?: string;
      github_token?: string;
      clear_github_token?: boolean;
      github_webhook_secret?: string;
      clear_webhook_secret?: boolean;
      auto_sync_seconds?: number;
      discord_webhook?: string;
      members?: Array<{ id: string; github_username: string }>;
    };

    if (typeof body.project_name === "string" && body.project_name.trim()) {
      await setSetting("project_name", body.project_name.trim());
    }
    if (typeof body.github_repo === "string") {
      await setSetting("github_repo", body.github_repo.trim());
    }
    if (typeof body.github_branch === "string") {
      await setSetting("github_branch", body.github_branch.trim() || "main");
    }
    if (body.clear_github_token) {
      await setSetting("github_token", "");
    } else if (typeof body.github_token === "string" && body.github_token.trim()) {
      await setSetting("github_token", body.github_token.trim());
    }
    if (body.clear_webhook_secret) {
      await setSetting("github_webhook_secret", "");
    } else if (typeof body.github_webhook_secret === "string" && body.github_webhook_secret.trim()) {
      await setSetting("github_webhook_secret", body.github_webhook_secret.trim());
    }
    if (typeof body.auto_sync_seconds === "number" && Number.isFinite(body.auto_sync_seconds)) {
      await setSetting("auto_sync_seconds", String(Math.max(0, Math.round(body.auto_sync_seconds))));
    }
    if (typeof body.discord_webhook === "string") {
      await setSetting("discord_webhook", body.discord_webhook.trim());
    }

    if (Array.isArray(body.members)) {
      for (const m of body.members) {
        await query("UPDATE members SET github_username = ? WHERE id = ?", [
          (m.github_username || "").trim().replace(/^@/, ""),
          m.id,
        ]);
      }
    }

    return NextResponse.json({ data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan pengaturan." },
      { status: 500 }
    );
  }
}
