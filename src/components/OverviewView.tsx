"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitCommitHorizontal,
  GitPullRequest,
  HelpCircle,
  Layers,
  RefreshCw,
} from "lucide-react";
import type { DashboardBootstrap, MemberId, NoteItem, TaskItem } from "@/lib/types";
import {
  formatRelativeTime,
  formatShortDate,
  getDueState,
  getMember,
  STATUS_META,
} from "./ui-helpers";

interface OverviewViewProps {
  data: DashboardBootstrap;
  onNavigate: (tab: string) => void;
  onOpenTask: (taskId: number) => void;
  onOpenNote: (noteId: number) => void;
  onSyncGitHub: () => void;
  syncing: boolean;
}

export default function OverviewView({
  data,
  onNavigate,
  onOpenTask,
  onOpenNote,
  onSyncGitHub,
  syncing,
}: OverviewViewProps) {
  const totalTasks = data.tasks.length;
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;
  const inReviewTasks = data.tasks.filter((t) => t.status === "in_review");
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const mandatoryRubric = data.rubric.filter((r) => r.section !== "Fitur Tambahan");
  const mandatoryDone = mandatoryRubric.filter((r) => r.is_done).length;
  const rubricPct = mandatoryRubric.length
    ? Math.round((mandatoryDone / mandatoryRubric.length) * 100)
    : 0;

  // Gather all open questions & blockers across tasks and notes
  const openQuestions: Array<{
    id: number;
    kind: "question" | "blocker";
    body: string;
    authorId: MemberId;
    createdAt: string;
    sourceLabel: string;
    sourceType: "task" | "note";
    sourceId: number;
  }> = [];

  for (const t of data.tasks) {
    for (const c of t.comments) {
      if ((c.kind === "question" || c.kind === "blocker") && !c.is_resolved) {
        openQuestions.push({
          id: c.id,
          kind: c.kind,
          body: c.body,
          authorId: c.author_id,
          createdAt: c.created_at,
          sourceLabel: `[${t.code}] ${t.title}`,
          sourceType: "task",
          sourceId: t.id,
        });
      }
    }
  }

  for (const n of data.notes) {
    for (const c of n.comments) {
      if ((c.kind === "question" || c.kind === "blocker") && !c.is_resolved) {
        openQuestions.push({
          id: c.id,
          kind: c.kind,
          body: c.body,
          authorId: c.author_id,
          createdAt: c.created_at,
          sourceLabel: n.title,
          sourceType: "note",
          sourceId: n.id,
        });
      }
    }
  }

  openQuestions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Upcoming tasks sorted by due date
  const upcomingTasks = [...data.tasks]
    .filter((t) => t.status !== "done" && t.due_date)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 5);

  const noteChecklistStats = data.notes.reduce(
    (acc, n: NoteItem) => {
      acc.total += n.checklists.length;
      acc.done += n.checklists.filter((c) => c.is_done).length;
      return acc;
    },
    { total: 0, done: 0 }
  );

  const ciLabel =
    data.settings.ci_status === "success"
      ? "Lolos (0 Error)"
      : data.settings.ci_status === "failure"
        ? "Gagal (Perlu Perbaikan)"
        : data.settings.ci_status === "in_progress"
          ? "Sedang Dicek"
          : "Belum Aktif";

  const ciDot =
    data.settings.ci_status === "success"
      ? "#10B981"
      : data.settings.ci_status === "failure"
        ? "#F43F5E"
        : data.settings.ci_status === "in_progress"
          ? "#F59E0B"
          : "#71717A";

  return (
    <div className="space-y-8">
      {/* Top Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wider uppercase text-[var(--text-muted)]">
            Ringkasan Proyek
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {data.settings.project_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pantau pembagian tugas tim, progres checklist, kendala yang perlu dijawab, dan aktivitas GitHub secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {data.settings.github_repo ? (
            <button
              onClick={onSyncGitHub}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Menyinkronkan..." : "Sync GitHub"}
            </button>
          ) : (
            <button
              onClick={() => onNavigate("settings")}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-medium text-[var(--accent-text)] transition hover:opacity-90"
            >
              Hubungkan Repo GitHub
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Progres Tugas</span>
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-semibold tracking-tight">{overallPct}%</span>
            <span className="tabular-nums text-xs text-[var(--text-secondary)]">
              {doneTasks} dari {totalTasks} selesai
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 ease-fluid"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("rubric")}
          className="surface-card rounded-xl p-5 text-left transition hover:border-[var(--border-strong)]"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Syarat Wajib Kuliah</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-semibold tracking-tight">{rubricPct}%</span>
            <span className="tabular-nums text-xs text-[var(--text-secondary)]">
              {mandatoryDone}/{mandatoryRubric.length} terpenuhi
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-fluid"
              style={{ width: `${rubricPct}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("notes")}
          className="surface-card rounded-xl p-5 text-left transition hover:border-[var(--border-strong)]"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Pertanyaan / Bingung</span>
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular-nums text-2xl font-semibold tracking-tight">
              {openQuestions.length}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {openQuestions.length > 0 ? "menunggu jawaban PM" : "semua terjawab"}
            </span>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)] tabular-nums">
            Ceklis Catatan: {noteChecklistStats.done}/{noteChecklistStats.total} selesai
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("github")}
          className="surface-card rounded-xl p-5 text-left transition hover:border-[var(--border-strong)]"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Quality Gate CI</span>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ciDot }} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">{ciLabel}</span>
          </div>
          <p className="mt-3 truncate text-xs text-[var(--text-muted)]">
            {data.settings.github_repo
              ? `Sync: ${formatRelativeTime(data.settings.last_sync_at)}`
              : "Repo belum dihubungkan"}
          </p>
        </button>
      </div>

      {/* Team Contribution Row */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Beban Kerja & Kontribusi Tim
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Otomatis terhitung dari Task & Commit GitHub
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.members.map((m) => {
            const mTasks = data.tasks.filter((t) => t.assignee_id === m.id);
            const mDone = mTasks.filter((t) => t.status === "done").length;
            const mReview = mTasks.filter((t) => t.status === "in_review").length;
            const mPct = mTasks.length ? Math.round((mDone / mTasks.length) * 100) : 0;
            const mCommits = data.github_events.filter(
              (e) => e.event_type === "commit" && e.member_id === m.id
            );
            const lastCommit = mCommits[0];

            return (
              <div key={m.id} className="surface-card rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: m.avatar_color }}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {m.name}
                        </h3>
                        <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                          {m.role}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{m.title}</p>
                    </div>
                  </div>
                  <span className="tabular-nums text-sm font-semibold text-[var(--text-primary)]">
                    {mPct}%
                  </span>
                </div>

                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-fluid"
                    style={{ width: `${mPct}%`, backgroundColor: m.avatar_color }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs">
                  <div>
                    <p className="text-[var(--text-muted)]">Tugas</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {mDone}/{mTasks.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Review</p>
                    <p className="mt-0.5 font-medium tabular-nums">{mReview}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Commit</p>
                    <p className="mt-0.5 font-medium tabular-nums">{mCommits.length}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span className="font-mono-code truncate">
                    {m.github_username ? `@${m.github_username}` : "GitHub belum di-map"}
                  </span>
                  <span>
                    {lastCommit ? formatRelativeTime(lastCommit.occurred_at) : "Belum ada push"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Split: Attention Queue & GitHub Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Questions + Review + Deadlines */}
        <div className="space-y-6 lg:col-span-7">
          {/* Open Questions / Confusion Queue */}
          <div className="surface-card rounded-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold">Bagian yang Membingungkan & Kendala Tim</h2>
              </div>
              <span className="tabular-nums text-xs text-[var(--text-muted)]">
                {openQuestions.length} terbuka
              </span>
            </div>

            {openQuestions.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
                Tidak ada pertanyaan atau kendala terbuka. Tim berjalan lancar.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {openQuestions.slice(0, 5).map((q) => {
                  const author = getMember(data.members, q.authorId);
                  return (
                    <button
                      key={`${q.sourceType}-${q.id}`}
                      type="button"
                      onClick={() =>
                        q.sourceType === "task" ? onOpenTask(q.sourceId) : onOpenNote(q.sourceId)
                      }
                      className="flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left transition hover:bg-[var(--bg-hover)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor:
                                q.kind === "blocker"
                                  ? "rgba(244,63,94,0.14)"
                                  : "rgba(245,158,11,0.14)",
                              color: q.kind === "blocker" ? "#F43F5E" : "#F59E0B",
                            }}
                          >
                            {q.kind === "blocker" ? "Kendala" : "Pertanyaan"}
                          </span>
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {author?.name || q.authorId}
                          </span>
                          <span className="truncate text-xs text-[var(--text-muted)]">
                            di {q.sourceLabel}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {q.body}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                        {formatRelativeTime(q.createdAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Review + Upcoming Deadlines */}
          <div className="surface-card rounded-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                <h2 className="text-sm font-semibold">
                  {inReviewTasks.length > 0
                    ? `Menunggu Review PM (${inReviewTasks.length}) & Tenggat Terdekat`
                    : "Tenggat Tugas Terdekat"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("tasks")}
                className="text-xs font-medium text-[var(--accent-text)] hover:underline"
              >
                Lihat semua
              </button>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {(inReviewTasks.length > 0 ? [...inReviewTasks, ...upcomingTasks.filter((u) => u.status !== "in_review")].slice(0, 6) : upcomingTasks).map(
                (t: TaskItem) => {
                  const member = getMember(data.members, t.assignee_id);
                  const dueState = getDueState(t.due_date, t.status);
                  const st = STATUS_META[t.status];

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: st.dot }}
                        />
                        <span className="font-mono-code shrink-0 text-xs text-[var(--text-muted)]">
                          {t.code}
                        </span>
                        <span className="truncate text-sm text-[var(--text-primary)]">
                          {t.title}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
                          {member?.name}
                        </span>
                        <span
                          className={`tabular-nums rounded px-2 py-0.5 text-[11px] font-medium ${
                            dueState === "overdue"
                              ? "bg-rose-500/15 text-rose-400"
                              : dueState === "soon"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {formatShortDate(t.due_date)}
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
              {upcomingTasks.length === 0 && inReviewTasks.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
                  Semua tugas dengan tenggat sudah selesai.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 cols: GitHub Feed */}
        <div className="surface-card flex flex-col rounded-xl lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <GitCommitHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
              <h2 className="text-sm font-semibold">Aktivitas GitHub Terbaru</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("github")}
              className="text-xs font-medium text-[var(--accent-text)] hover:underline"
            >
              Detail
            </button>
          </div>

          {data.github_events.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Belum ada aktivitas GitHub tercatat
              </p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
                Masukkan link repository GitHub aplikasi Flutter di menu Pengaturan agar setiap push dan PR dari Yoga atau Juli terdeteksi otomatis.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className="mt-4 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-border)]"
              >
                Buka Pengaturan Repo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {data.github_events.slice(0, 7).map((ev) => {
                const member = getMember(data.members, ev.member_id);
                return (
                  <a
                    key={ev.id}
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-[var(--bg-hover)]"
                  >
                    <div className="mt-0.5 text-[var(--text-muted)]">
                      {ev.event_type === "pr" ? (
                        <GitPullRequest className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <GitCommitHorizontal className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {ev.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span className="font-mono-code">{ev.sha_or_number}</span>
                        <span>{member ? member.name : ev.author_login}</span>
                        {ev.linked_task_code && (
                          <span className="font-mono-code rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-text)]">
                            {ev.linked_task_code}
                          </span>
                        )}
                        <span className="ml-auto">{formatRelativeTime(ev.occurred_at)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
