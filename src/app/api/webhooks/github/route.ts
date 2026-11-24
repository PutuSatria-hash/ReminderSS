import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSettingsMap } from "@/lib/db";
import { processGitHubWebhookEvent } from "@/lib/github";

export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
  const a = Buffer.from(signatureHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const eventName = req.headers.get("x-github-event") || "unknown";
    const signature = req.headers.get("x-hub-signature-256");

    const settings = await getSettingsMap();
    const secret = (
      process.env.GITHUB_WEBHOOK_SECRET ||
      settings.github_webhook_secret ||
      ""
    ).trim();

    if (secret && !verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const result = await processGitHubWebhookEvent(eventName, payload);
    return NextResponse.json({ ok: true, event: eventName, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/github",
    supported_events: ["ping", "push", "pull_request", "workflow_run"],
  });
}
