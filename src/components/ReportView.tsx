"use client";

import { Download, Printer } from "lucide-react";
import type { DashboardBootstrap } from "@/lib/types";
import {
  formatShortDate,
  generateMarkdownReport,
  getMember,
  STATUS_META,
} from "./ui-helpers";

interface ReportViewProps {
  data: DashboardBootstrap;
  onToast: (msg: string) => void;
}

export default function ReportView({ data, onToast }: ReportViewProps) {
  const totalTasks = data.tasks.length;
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;
  const taskPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const mandatoryRubric = data.rubric.filter((r) => r.section !== "Fitur Tambahan");
  const mandatoryDone = mandatoryRubric.filter((r) => r.is_done).length;
  const rubricPct = mandatoryRubric.length
    ? Math.round((mandatoryDone / mandatoryRubric.length) * 100)
    : 0;

  function downloadMarkdown() {
    const md = generateMarkdownReport(data);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-progres-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast("Laporan Markdown (.md) berhasil diunduh.");
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Pelaporan Dosen & Presentasi
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Laporan Progres Tim</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Ringkasan otomatis dari database lokal laptop Boss. Siap dicetak sebagai PDF atau diunduh ke Markdown.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh .md
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="surface-card print-only-full space-y-7 rounded-2xl p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Laporan Status Proyek — Pemrograman Mobile
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {data.settings.project_name}
            </h2>
            <p className="mt-1 font-mono-code text-xs text-[var(--text-muted)]">
              Repo: {data.settings.github_repo || "Belum terhubung"}
            </p>
          </div>
          <div className="text-right text-xs text-[var(--text-secondary)]">
            <p>
              Tanggal:{" "}
              {new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="mt-1">
              Progres Tugas: <strong className="tabular-nums">{taskPct}%</strong> ({doneTasks}/{totalTasks})
            </p>
            <p className="mt-0.5">
              Syarat Wajib: <strong className="tabular-nums">{rubricPct}%</strong> ({mandatoryDone}/{mandatoryRubric.length})
            </p>
          </div>
        </div>

        {/* Contribution Matrix */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">1. Distribusi & Kontribusi Anggota</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Anggota</th>
                  <th className="px-4 py-2.5 font-medium">Peran</th>
                  <th className="px-4 py-2.5 font-medium">Tugas Selesai</th>
                  <th className="px-4 py-2.5 font-medium">Ceklis Note</th>
                  <th className="px-4 py-2.5 font-medium">Commit GitHub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.members.map((m) => {
                  const mTasks = data.tasks.filter((t) => t.assignee_id === m.id);
                  const mDone = mTasks.filter((t) => t.status === "done").length;
                  const noteChecks = data.notes.flatMap((n) =>
                    n.checklists.filter((c) => c.assignee_id === m.id)
                  );
                  const noteDone = noteChecks.filter((c) => c.is_done).length;
                  const commits = data.github_events.filter(
                    (e) => e.event_type === "commit" && e.member_id === m.id
                  ).length;

                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{m.name}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{m.title}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {mDone} / {mTasks.length}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {noteDone} / {noteChecks.length}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{commits}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Breakdown */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">2. Rekapitulasi Seluruh Tugas</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Kode</th>
                  <th className="px-4 py-2.5 font-medium">Judul Tugas</th>
                  <th className="px-4 py-2.5 font-medium">PIC</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Tenggat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono-code px-4 py-2.5 text-[var(--text-muted)]">{t.code}</td>
                    <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.title}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                      {getMember(data.members, t.assignee_id)?.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: STATUS_META[t.status].badgeBg,
                          color: STATUS_META[t.status].badgeText,
                        }}
                      >
                        {STATUS_META[t.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--text-muted)]">
                      {formatShortDate(t.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Checklists Summary */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">3. Ringkasan Catatan & Ceklis PM</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.notes.map((n) => {
              const cDone = n.checklists.filter((c) => c.is_done).length;
              return (
                <div
                  key={n.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</h4>
                    <span className="tabular-nums text-[11px] text-[var(--text-muted)]">
                      {cDone}/{n.checklists.length} ceklis
                    </span>
                  </div>
                  {n.content && (
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {n.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
