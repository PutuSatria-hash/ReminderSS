"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  ExternalLink,
  GitCommitHorizontal,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type {
  CommentKind,
  DashboardBootstrap,
  MemberId,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import {
  COMMENT_KIND_META,
  formatDateTime,
  formatShortDate,
  getDueState,
  getMember,
  PRIORITY_META,
  STATUS_META,
} from "./ui-helpers";

interface TasksViewProps {
  data: DashboardBootstrap;
  activeUser: MemberId;
  selectedTaskId: number | null;
  onSelectTask: (id: number | null) => void;
  onDataChange: (next: DashboardBootstrap) => void;
  onToast: (msg: string) => void;
}

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

export default function TasksView({
  data,
  activeUser,
  selectedTaskId,
  onSelectTask,
  onDataChange,
  onToast,
}: TasksViewProps) {
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState<MemberId>("yoga");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDue, setNewDue] = useState("");
  const [newCheckRaw, setNewCheckRaw] = useState("");
  const [saving, setSaving] = useState(false);

  // Drawer interactions
  const [newSubtask, setNewSubtask] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>(
    activeUser === "boss" ? "answer" : "question"
  );

  const selectedTask: TaskItem | null = useMemo(
    () => data.tasks.find((t) => t.id === selectedTaskId) || null,
    [data.tasks, selectedTaskId]
  );

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((t) => {
      if (filterMember !== "all" && t.assignee_id !== filterMember) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          t.title.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [data.tasks, filterMember, filterStatus, searchQuery]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const checklists = newCheckRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim() || undefined,
          title: newTitle.trim(),
          description: newDesc.trim(),
          assignee_id: newAssignee,
          priority: newPriority,
          due_date: newDue || null,
          checklists,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah tugas");
      onDataChange(json.data);
      setShowCreateModal(false);
      setNewTitle("");
      setNewCode("");
      setNewDesc("");
      setNewDue("");
      setNewCheckRaw("");
      onToast(`Tugas ${json.code} berhasil dibuat.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Gagal membuat tugas.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId: number, payload: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
    }
  }

  async function deleteTask(taskId: number) {
    if (!confirm("Hapus tugas ini beserta seluruh checklist dan komentarnya?")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.data) {
      onSelectTask(null);
      onDataChange(json.data);
      onToast("Tugas dihapus.");
    }
  }

  async function addChecklist(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !newSubtask.trim()) return;
    const res = await fetch(`/api/tasks/${selectedTask.id}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newSubtask.trim() }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      setNewSubtask("");
    }
  }

  async function toggleChecklist(taskId: number, checklistId: number, nextDone: boolean) {
    const res = await fetch(`/api/tasks/${taskId}/checklists`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist_id: checklistId, is_done: nextDone }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function removeChecklist(taskId: number, checklistId: number) {
    const res = await fetch(`/api/tasks/${taskId}/checklists?checklistId=${checklistId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !commentBody.trim()) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: "task",
        target_id: selectedTask.id,
        author_id: activeUser,
        body: commentBody.trim(),
        kind: commentKind,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      setCommentBody("");
      onToast(
        commentKind === "question" || commentKind === "blocker"
          ? "Pertanyaan dikirim dan masuk ke antrean notifikasi PM."
          : "Komentar ditambahkan."
      );
    }
  }

  async function toggleResolveComment(commentId: number, nextResolved: boolean) {
    const res = await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId, is_resolved: nextResolved }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Pembagian Kerja
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Daftar Tugas Tim</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Sertakan kode tugas seperti <span className="font-mono-code text-xs text-[var(--accent-text)]">[BE-01]</span> di pesan commit GitHub agar status otomatis berpindah ke Menunggu Review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Buat Tugas Baru
        </button>
      </div>

      {/* Filter Bar */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode atau judul..."
              className="input-field w-52 rounded-lg py-1.5 pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMember("all")}
              className={`rounded-md px-2.5 py-1 transition ${
                filterMember === "all"
                  ? "bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Semua
            </button>
            {data.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFilterMember(m.id)}
                className={`rounded-md px-2.5 py-1 transition ${
                  filterMember === m.id
                    ? "bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field rounded-lg px-2.5 py-1.5 text-xs"
          >
            <option value="all">Semua Status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
              viewMode === "list"
                ? "bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Daftar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
              viewMode === "board"
                ? "bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Papan
          </button>
        </div>
      </div>

      {/* Task List View */}
      {viewMode === "list" ? (
        <div className="surface-card overflow-hidden rounded-xl">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredTasks.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
                Tidak ada tugas yang cocok dengan filter saat ini.
              </div>
            ) : (
              filteredTasks.map((t) => {
                const member = getMember(data.members, t.assignee_id);
                const st = STATUS_META[t.status];
                const pr = PRIORITY_META[t.priority];
                const dueState = getDueState(t.due_date, t.status);
                const doneChecks = t.checklists.filter((c) => c.is_done).length;
                const openQs = t.comments.filter(
                  (c) => (c.kind === "question" || c.kind === "blocker") && !c.is_resolved
                ).length;

                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t.id)}
                    className="group flex cursor-pointer flex-col gap-3 px-5 py-3.5 transition hover:bg-[var(--bg-hover)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        title="Tandai selesai / buka kembali"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTask(t.id, { status: t.status === "done" ? "in_progress" : "done" });
                        }}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          t.status === "done"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-[var(--border-strong)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {t.status === "done" && <Check className="h-3 w-3" />}
                      </button>

                      <span className="font-mono-code shrink-0 text-xs text-[var(--text-muted)]">
                        {t.code}
                      </span>

                      <span
                        className={`truncate text-sm font-medium ${
                          t.status === "done"
                            ? "text-[var(--text-muted)] line-through"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {t.title}
                      </span>

                      {openQs > 0 && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          {openQs} tanya
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-7 text-xs sm:pl-0">
                      {t.linked_events.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono-code text-[11px] text-[var(--accent-text)]">
                          <GitCommitHorizontal className="h-3.5 w-3.5" />
                          {t.linked_events.length}
                        </span>
                      )}

                      {t.checklists.length > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums text-[11px] text-[var(--text-muted)]">
                          <CheckSquare className="h-3.5 w-3.5" />
                          {doneChecks}/{t.checklists.length}
                        </span>
                      )}

                      {t.comments.length > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums text-[11px] text-[var(--text-muted)]">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {t.comments.length}
                        </span>
                      )}

                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: st.badgeBg, color: st.badgeText }}
                      >
                        {st.label}
                      </span>

                      <span
                        className="w-12 text-right text-[11px] font-medium"
                        style={{ color: pr.color }}
                      >
                        {pr.label}
                      </span>

                      <span
                        className={`w-16 text-right tabular-nums text-[11px] ${
                          dueState === "overdue"
                            ? "font-medium text-rose-400"
                            : dueState === "soon"
                              ? "font-medium text-amber-400"
                              : "text-[var(--text-muted)]"
                        }`}
                      >
                        {formatShortDate(t.due_date)}
                      </span>

                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                        style={{ backgroundColor: member?.avatar_color || "#6366F1" }}
                        title={member?.name}
                      >
                        {(member?.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((statusKey) => {
            const st = STATUS_META[statusKey];
            const items = filteredTasks.filter((t) => t.status === statusKey);
            return (
              <div
                key={statusKey}
                className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: st.dot }}
                    />
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                      {st.label}
                    </h3>
                  </div>
                  <span className="tabular-nums text-xs text-[var(--text-muted)]">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {items.map((t) => {
                    const member = getMember(data.members, t.assignee_id);
                    const doneChecks = t.checklists.filter((c) => c.is_done).length;
                    const openQs = t.comments.filter(
                      (c) => (c.kind === "question" || c.kind === "blocker") && !c.is_resolved
                    ).length;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTask(t.id)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-left transition hover:border-[var(--border-strong)]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                            {t.code}
                          </span>
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold text-white"
                            style={{ backgroundColor: member?.avatar_color || "#6366F1" }}
                          >
                            {(member?.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium leading-snug text-[var(--text-primary)]">
                          {t.title}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span className="tabular-nums">
                            {t.checklists.length > 0
                              ? `${doneChecks}/${t.checklists.length} ceklis`
                              : formatShortDate(t.due_date)}
                          </span>
                          <div className="flex items-center gap-2">
                            {openQs > 0 && (
                              <span className="font-medium text-amber-400">{openQs} tanya</span>
                            )}
                            {t.linked_events.length > 0 && (
                              <span className="font-mono-code text-[var(--accent-text)]">
                                {t.linked_events.length} git
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-6 text-center text-[11px] text-[var(--text-muted)]">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Buat Tugas Baru</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Judul Tugas
                  </label>
                  <input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Contoh: Validasi duplikat nama mata kuliah"
                    className="input-field w-full rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Kode (Opsional)
                  </label>
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Auto (BE-06)"
                    className="input-field font-mono-code w-full rounded-lg px-3 py-2 text-sm uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Penanggung Jawab
                  </label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value as MemberId)}
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  >
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Prioritas
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Tenggat Internal
                  </label>
                  <input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Deskripsi / Kriteria Selesai
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Jelaskan ekspektasi output atau detail teknis untuk anggota tim..."
                  className="input-field w-full rounded-lg px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Daftar Ceklis Awal (1 baris = 1 item, opsional)
                </label>
                <textarea
                  rows={3}
                  value={newCheckRaw}
                  onChange={(e) => setNewCheckRaw(e.target.value)}
                  placeholder={"Buat fungsi query\nTambahkan validator\nUji di emulator"}
                  className="input-field w-full rounded-lg px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Tugas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Task Detail Drawer */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
          onClick={() => onSelectTask(null)}
        >
          <div
            className="surface-modal flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[var(--border-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono-code rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-text)]">
                  {selectedTask.code}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  Tag commit: [{selectedTask.code}]
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => deleteTask(selectedTask.id)}
                  title="Hapus tugas"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTask(null)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold leading-snug text-[var(--text-primary)]">
                  {selectedTask.title}
                </h2>
                {selectedTask.description && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {selectedTask.description}
                  </p>
                )}
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 sm:grid-cols-4">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Status
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateTask(selectedTask.id, { status: e.target.value })}
                    className="mt-1 w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s} className="bg-[var(--bg-surface)]">
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    PIC
                  </label>
                  <select
                    value={selectedTask.assignee_id}
                    onChange={(e) => updateTask(selectedTask.id, { assignee_id: e.target.value })}
                    className="mt-1 w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                  >
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[var(--bg-surface)]">
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Prioritas
                  </label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => updateTask(selectedTask.id, { priority: e.target.value })}
                    className="mt-1 w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="high" className="bg-[var(--bg-surface)]">Tinggi</option>
                    <option value="medium" className="bg-[var(--bg-surface)]">Sedang</option>
                    <option value="low" className="bg-[var(--bg-surface)]">Rendah</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Tenggat
                  </label>
                  <input
                    type="date"
                    value={selectedTask.due_date || ""}
                    onChange={(e) => updateTask(selectedTask.id, { due_date: e.target.value || null })}
                    className="mt-1 w-full bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Subtask Checklist */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Ceklis Pengerjaan
                  </h3>
                  <span className="tabular-nums text-xs text-[var(--text-secondary)]">
                    {selectedTask.checklists.filter((c) => c.is_done).length}/
                    {selectedTask.checklists.length} selesai
                  </span>
                </div>

                <div className="space-y-1.5">
                  {selectedTask.checklists.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecklist(selectedTask.id, item.id, !item.is_done)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          item.is_done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-[var(--border-strong)]"
                        }`}
                      >
                        {item.is_done && <Check className="h-3 w-3" />}
                      </button>
                      <span
                        className={`flex-1 text-xs ${
                          item.is_done
                            ? "text-[var(--text-muted)] line-through"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChecklist(selectedTask.id, item.id)}
                        className="opacity-0 transition group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={addChecklist} className="mt-2.5 flex gap-2">
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Tambah item ceklis baru..."
                    className="input-field flex-1 rounded-lg px-3 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-border)]"
                  >
                    Tambah
                  </button>
                </form>
              </div>

              {/* Linked GitHub Activity */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Bukti Commit / PR GitHub Terdeteksi ({selectedTask.linked_events.length})
                </h3>
                {selectedTask.linked_events.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3.5 py-3 text-xs text-[var(--text-muted)]">
                    Belum ada commit dengan tag <span className="font-mono-code text-[var(--text-secondary)]">[{selectedTask.code}]</span>. Minta PIC menyertakan kode tersebut saat git commit.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.linked_events.map((ev) => (
                      <a
                        key={ev.id}
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs transition hover:border-[var(--accent-border)]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-code text-[var(--accent-text)]">
                              {ev.sha_or_number}
                            </span>
                            <span className="truncate font-medium text-[var(--text-primary)]">
                              {ev.title}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                            {ev.author_login} — {formatDateTime(ev.occurred_at)}
                          </p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments & Confusion Thread */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Diskusi & Bagian yang Membingungkan ({selectedTask.comments.length})
                </h3>

                <div className="space-y-2.5">
                  {selectedTask.comments.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Belum ada komentar. Jika ada yang bingung, tulis pertanyaan di bawah.
                    </p>
                  ) : (
                    selectedTask.comments.map((cm) => {
                      const author = getMember(data.members, cm.author_id);
                      const meta = COMMENT_KIND_META[cm.kind];
                      const isAsk = cm.kind === "question" || cm.kind === "blocker";
                      return (
                        <div
                          key={cm.id}
                          className={`rounded-xl border p-3.5 ${
                            isAsk && !cm.is_resolved
                              ? "border-amber-500/30 bg-amber-500/[0.04]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold text-white"
                                style={{ backgroundColor: author?.avatar_color || "#6366F1" }}
                              >
                                {(author?.name || "?").slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-xs font-semibold text-[var(--text-primary)]">
                                {author?.name}
                              </span>
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: meta.bg, color: meta.color }}
                              >
                                {meta.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isAsk && (
                                <button
                                  type="button"
                                  onClick={() => toggleResolveComment(cm.id, !cm.is_resolved)}
                                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                                    cm.is_resolved
                                      ? "bg-emerald-500/15 text-emerald-400"
                                      : "border border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-emerald-500/50 hover:text-emerald-400"
                                  }`}
                                >
                                  {cm.is_resolved ? "Terjawab" : "Tandai Terjawab"}
                                </button>
                              )}
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {formatDateTime(cm.created_at)}
                              </span>
                            </div>
                          </div>

                          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                            {cm.body}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendComment} className="mt-4 space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Kirim sebagai{" "}
                      <strong className="text-[var(--text-primary)]">
                        {getMember(data.members, activeUser)?.name}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1">
                      {(["comment", "question", "blocker", "answer"] as CommentKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setCommentKind(k)}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                            commentKind === k
                              ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {COMMENT_KIND_META[k].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder={
                        commentKind === "question"
                          ? "Tulis bagian mana yang masih membingungkan..."
                          : "Tulis komentar atau arahan..."
                      }
                      className="input-field flex-1 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-medium text-white hover:opacity-90"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Kirim
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
