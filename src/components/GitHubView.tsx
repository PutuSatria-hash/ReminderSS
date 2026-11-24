"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { DashboardBootstrap } from "@/lib/types";
import {
  FLUTTER_CI_WORKFLOW,
  formatDateTime,
  formatRelativeTime,
  getMember,
} from "./ui-helpers";

interface GitHubViewProps {
  data: DashboardBootstrap;
  syncing: boolean;
  onSync: () => void;
  onNavigate: (tab: string) => void;
  onOpenTaskByCode: (code: string) => void;
}

export default function GitHubView({
  data,
  syncing,
  onSync,
  onNavigate,
  onOpenTaskByCode,
}: GitHubViewProps) {
  const [filterType, setFilterType] = useState<"all" | "commit" | "pr">("all");
  const [copiedCi, setCopiedCi] = useState(false);

  const filteredEvents = data.github_events.filter((ev) =>
    filterType === "all" ? true : ev.event_type === filterType
  );

  function copyCiYaml() {
    navigator.clipboard.writeText(FLUTTER_CI_WORKFLOW);
    setCopiedCi(true);
    setTimeout(() => setCopiedCi(false), 1800);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Deteksi Otomatis
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">GitHub Monitor</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Menarik commit, Pull Request, dan status <span className="font-mono-code text-xs">flutter analyze</span> secara otomatis dari repository aplikasi Flutter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            Atur Repo
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing || !data.settings.github_repo}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Menyinkronkan..." : "Sync Sekarang"}
          </button>
        </div>
      </div>

      {/* Repo Connection & CI Status Bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="surface-card rounded-xl p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <GitBranch className="h-4 w-4 text-[var(--accent-text)]" />
              <span className="font-mono-code text-sm font-medium text-[var(--text-primary)]">
                {data.settings.github_repo || "Belum terhubung ke repository"}
              </span>
              {data.settings.github_repo && (
                <span className="font-mono-code rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                  branch: {data.settings.github_branch}
                </span>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Auto-sync:{" "}
              {data.settings.auto_sync_seconds > 0
                ? `tiap ${data.settings.auto_sync_seconds} detik`
                : "Manual"}
            </span>
          </div>
          <p className="mt-2.5 text-xs text-[var(--text-secondary)]">
            {data.settings.last_sync_message || "Siap menyinkronkan."}
          </p>
          {data.settings.last_sync_at && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Sinkron terakhir: {formatDateTime(data.settings.last_sync_at)}
            </p>
          )}
        </div>

        <div className="surface-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Status GitHub Actions</span>
            <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  data.settings.ci_status === "success"
                    ? "#10B981"
                    : data.settings.ci_status === "failure"
                      ? "#F43F5E"
                      : data.settings.ci_status === "in_progress"
                        ? "#F59E0B"
                        : "#71717A",
              }}
            />
            <span className="text-sm font-semibold">
              {data.settings.ci_status === "success"
                ? "Passed (0 Error)"
                : data.settings.ci_status === "failure"
                  ? "Failed (Ada Error)"
                  : data.settings.ci_status === "in_progress"
                    ? "Running..."
                    : "Belum Terdeteksi"}
            </span>
          </div>
          <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]">
            {data.settings.ci_workflow_name || "Pasang flutter_analyze.yml di repo Flutter"}
          </p>
          {data.settings.ci_url && (
            <a
              href={data.settings.ci_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline"
            >
              Lihat log Actions
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Main Split: Feed & Convention Guide */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="surface-card overflow-hidden rounded-xl lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
            <h2 className="text-sm font-semibold">Riwayat Commit & Pull Request</h2>
            <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 text-xs">
              {(["all", "commit", "pr"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    filterType === t
                      ? "bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {t === "all" ? "Semua" : t === "commit" ? "Commit" : "PR"}
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Belum ada commit atau PR yang tersimpan
              </p>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Begitu link repository GitHub dimasukkan di Pengaturan dan disinkronkan, semua push dari Yoga dan Juli akan tampil otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredEvents.map((ev) => {
                const member = getMember(data.members, ev.member_id);
                return (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-4 px-5 py-3.5 transition hover:bg-[var(--bg-hover)]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 text-[var(--text-muted)]">
                        {ev.event_type === "pr" ? (
                          <GitPullRequest className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <GitCommitHorizontal className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-1 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-text)]"
                        >
                          {ev.title}
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span className="font-mono-code text-[11px]">{ev.sha_or_number}</span>
                          <span>·</span>
                          <span className="font-medium text-[var(--text-secondary)]">
                            {member ? `${member.name} (@${ev.author_login})` : `@${ev.author_login}`}
                          </span>
                          {ev.event_type === "pr" && (
                            <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] uppercase">
                              {ev.state}
                            </span>
                          )}
                          {ev.linked_task_code && (
                            <button
                              type="button"
                              onClick={() => onOpenTaskByCode(ev.linked_task_code!)}
                              className="font-mono-code rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-text)] hover:underline"
                            >
                              Terkait {ev.linked_task_code}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                      {formatRelativeTime(ev.occurred_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Auto-Detection Guide + CI YAML */}
        <div className="space-y-4 lg:col-span-4">
          <div className="surface-card rounded-xl p-5">
            <h3 className="text-sm font-semibold">Aturan Tag Commit Otomatis</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              Bagikan format pesan commit ini ke Yoga dan Juli agar sistem otomatis menautkan commit ke kartu tugas dan mengubah statusnya menjadi{" "}
              <strong className="text-[var(--text-primary)]">Menunggu Review</strong>:
            </p>
            <div className="mt-3 space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono-code text-[11px] text-[var(--text-primary)]">
              <div>feat: buat tabel sqflite [BE-01]</div>
              <div>feat: form validator tugas [FE-04]</div>
              <div>fix: cegah hapus matkul aktif [BE-02]</div>
            </div>
            <p className="mt-2.5 text-[11px] text-[var(--text-muted)]">
              Jika Pull Request dengan tag kode di-merge, status tugas otomatis berubah menjadi Selesai.
            </p>
          </div>

          <div className="surface-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">CI Workflow Flutter</h3>
              <button
                type="button"
                onClick={copyCiYaml}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {copiedCi ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedCi ? "Tersalin" : "Salin YAML"}
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Simpan di <span className="font-mono-code">.github/workflows/flutter_analyze.yml</span> pada repo Flutter.
            </p>
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono-code text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {FLUTTER_CI_WORKFLOW}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
