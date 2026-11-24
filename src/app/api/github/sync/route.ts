import { NextResponse } from "next/server";
import { getDashboardBootstrap } from "@/lib/db";
import { syncGitHubRepository } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncGitHubRepository();
    return NextResponse.json({ result, data: await getDashboardBootstrap() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal sinkronisasi GitHub." },
      { status: 500 }
    );
  }
}
