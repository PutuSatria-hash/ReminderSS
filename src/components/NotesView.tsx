"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  MessageSquare,
  Pin,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type {
  CommentKind,
  DashboardBootstrap,
  MemberId,
  NoteCategory,
  NoteItem,
} from "@/lib/types";
import {
  COMMENT_KIND_META,
  formatDateTime,
  formatRelativeTime,
  getMember,
  NOTE_CATEGORY_META,
} from "./ui-helpers";

interface NotesViewProps {
  data: DashboardBootstrap;
  activeUser: MemberId;
  selectedNoteId: number | null;
  onSelectNote: (id: number | null) => void;
  onDataChange: (next: DashboardBootstrap) => void;
  onToast: (msg: string) => void;
}

export default function NotesView({
  data,
  activeUser,
  selectedNoteId,
  onSelectNote,
  onDataChange,
  onToast,
}: NotesViewProps) {
  const activeNote: NoteItem | null = useMemo(() => {
    if (selectedNoteId) {
      const found = data.notes.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return data.notes[0] || null;
  }, [data.notes, selectedNoteId]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<NoteCategory>("checklist");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newContent, setNewContent] = useState("");
  const [newChecksRaw, setNewChecksRaw] = useState("");

  // Inline editor for active note
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);

  // Add checklist item inside active note
  const [checkLabel, setCheckLabel] = useState("");
  const [checkAssignee, setCheckAssignee] = useState<string>("");

  // Comment inside active note
  const [commentBody, setCommentBody] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>(
    activeUser === "boss" ? "comment" : "question"
  );

  useEffect(() => {
    if (activeNote) {
      setEditTitle(activeNote.title);
      setEditContent(activeNote.content);
      setDirty(false);
    }
  }, [activeNote?.id, activeNote?.title, activeNote?.content]);

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const checklists = newChecksRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ label, assignee_id: newAssignee || null }));

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        author_id: activeUser,
        assignee_id: newAssignee || null,
        checklists,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      onSelectNote(json.id);
      setShowCreateModal(false);
      setNewTitle("");
      setNewContent("");
      setNewChecksRaw("");
      onToast("Catatan baru berhasil dibuat.");
    }
  }

  async function saveActiveNote() {
    if (!activeNote || !editTitle.trim()) return;
    const res = await fetch(`/api/notes/${activeNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      setDirty(false);
      onToast("Catatan disimpan.");
    }
  }

  async function togglePin(note: NoteItem) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function deleteNote(note: NoteItem) {
    if (!confirm(`Hapus catatan "${note.title}"?`)) return;
    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      onSelectNote(null);
      onToast("Catatan dihapus.");
    }
  }

  async function addChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activeNote || !checkLabel.trim()) return;
    const res = await fetch(`/api/notes/${activeNote.id}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: checkLabel.trim(),
        assignee_id: checkAssignee || null,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      setCheckLabel("");
    }
  }

  async function toggleCheckItem(noteId: number, checklistId: number, nextDone: boolean) {
    const res = await fetch(`/api/notes/${noteId}/checklists`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checklist_id: checklistId,
        is_done: nextDone,
        checked_by: activeUser,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function removeCheckItem(noteId: number, checklistId: number) {
    const res = await fetch(`/api/notes/${noteId}/checklists?checklistId=${checklistId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeNote || !commentBody.trim()) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: "note",
        target_id: activeNote.id,
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
          ? "Pertanyaan dikirim dan masuk ke notifikasi PM."
          : "Komentar ditambahkan."
      );
    }
  }

  async function toggleResolveComment(id: number, nextResolved: boolean) {
    const res = await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_resolved: nextResolved }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  const activeDoneChecks = activeNote
    ? activeNote.checklists.filter((c) => c.is_done).length
    : 0;
  const activeCheckPct =
    activeNote && activeNote.checklists.length > 0
      ? Math.round((activeDoneChecks / activeNote.checklists.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Catatan & Evaluasi
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Notes, Checklist & Diskusi Tim
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Catat arahan, centang item yang sudah dikerjakan Yoga atau Juli, dan tampung komentar bagian yang mereka bingung di satu tempat.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Buat Note Baru
        </button>
      </div>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left List */}
        <div className="space-y-2.5 lg:col-span-4">
          {data.notes.length === 0 ? (
            <div className="surface-card rounded-xl p-8 text-center text-xs text-[var(--text-muted)]">
              Belum ada catatan. Klik &ldquo;Buat Note Baru&rdquo; untuk memulai.
            </div>
          ) : (
            data.notes.map((n) => {
              const cat = NOTE_CATEGORY_META[n.category];
              const done = n.checklists.filter((c) => c.is_done).length;
              const openQs = n.comments.filter(
                (c) => (c.kind === "question" || c.kind === "blocker") && !c.is_resolved
              ).length;
              const isSelected = activeNote?.id === n.id;

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelectNote(n.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? "border-[var(--accent-border)] bg-[var(--bg-surface)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {n.is_pinned && <Pin className="h-3 w-3 text-[var(--accent-text)]" />}
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatRelativeTime(n.updated_at)}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">
                    {n.title}
                  </h3>
                  {n.content && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {n.content}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CheckSquare className="h-3.5 w-3.5" />
                      {done}/{n.checklists.length} ceklis
                    </span>
                    <div className="flex items-center gap-2">
                      {openQs > 0 && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          {openQs} bingung
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <MessageSquare className="h-3 w-3" />
                        {n.comments.length}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Workspace */}
        <div className="lg:col-span-8">
          {!activeNote ? (
            <div className="surface-card flex h-64 items-center justify-center rounded-xl text-sm text-[var(--text-muted)]">
              Pilih catatan di sebelah kiri untuk membuka detail & checklist.
            </div>
          ) : (
            <div className="surface-card rounded-xl p-6 space-y-6">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: NOTE_CATEGORY_META[activeNote.category].color }}
                  />
                  <span>{NOTE_CATEGORY_META[activeNote.category].label}</span>
                  <span>·</span>
                  <span>Diperbarui {formatDateTime(activeNote.updated_at)}</span>
                </div>

                <div className="flex items-center gap-2">
                  {dirty && (
                    <button
                      type="button"
                      onClick={saveActiveNote}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Simpan Perubahan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => togglePin(activeNote)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      activeNote.is_pinned
                        ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                        : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                    title="Sematkan catatan"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNote(activeNote)}
                    className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-muted)] hover:border-rose-500/40 hover:text-rose-400"
                    title="Hapus catatan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Editable Title & Body */}
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full bg-transparent text-lg font-semibold tracking-tight text-[var(--text-primary)] focus:outline-none"
                  placeholder="Judul catatan..."
                />
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Tulis ringkasan meeting, catatan review kode, atau arahan untuk Yoga & Juli..."
                  className="input-field w-full rounded-xl px-4 py-3 text-sm leading-relaxed"
                />
              </div>

              {/* Interactive Progress Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Ceklis Pekerjaan Tim
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Centang item yang sudah beres dikerjakan oleh masing-masing anggota.
                    </p>
                  </div>
                  <span className="tabular-nums text-xs font-semibold text-[var(--text-primary)]">
                    {activeDoneChecks}/{activeNote.checklists.length} ({activeCheckPct}%)
                  </span>
                </div>

                {activeNote.checklists.length > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-fluid"
                      style={{ width: `${activeCheckPct}%` }}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  {activeNote.checklists.map((item) => {
                    const pic = getMember(data.members, item.assignee_id);
                    const checker = getMember(data.members, item.checked_by);
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-3.5 py-2.5 transition hover:border-[var(--border-strong)]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCheckItem(activeNote.id, item.id, !item.is_done)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            item.is_done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-[var(--border-strong)] hover:border-[var(--accent)]"
                          }`}
                        >
                          {item.is_done && <Check className="h-3 w-3" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs ${
                              item.is_done
                                ? "text-[var(--text-muted)] line-through"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.is_done && checker && (
                            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                              Dicentang oleh {checker.name} · {formatRelativeTime(item.checked_at)}
                            </p>
                          )}
                        </div>

                        {pic && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${pic.avatar_color}22`,
                              color: pic.avatar_color,
                            }}
                          >
                            {pic.name}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => removeCheckItem(activeNote.id, item.id)}
                          className="opacity-0 transition group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={addChecklistItem} className="flex flex-wrap gap-2 pt-1">
                  <input
                    value={checkLabel}
                    onChange={(e) => setCheckLabel(e.target.value)}
                    placeholder="Tambah item ceklis baru untuk dicek..."
                    className="input-field min-w-[200px] flex-1 rounded-lg px-3 py-2 text-xs"
                  />
                  <select
                    value={checkAssignee}
                    onChange={(e) => setCheckAssignee(e.target.value)}
                    className="input-field rounded-lg px-2.5 py-2 text-xs"
                  >
                    <option value="">Umum</option>
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-border)]"
                  >
                    Tambah Ceklis
                  </button>
                </form>
              </div>

              {/* Comments & Confusion Discussion */}
              <div className="border-t border-[var(--border-subtle)] pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Komentar & Ruang Tanya ({activeNote.comments.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Yoga dan Juli bisa langsung berkomentar di sini jika ada bagian yang membingungkan.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {activeNote.comments.map((cm) => {
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold text-white"
                              style={{ backgroundColor: author?.avatar_color || "#6366F1" }}
                            >
                              {(author?.name || "?").slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-xs font-semibold">{author?.name}</span>
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
                  })}
                </div>

                <form
                  onSubmit={sendComment}
                  className="mt-4 space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Berkomentar sebagai{" "}
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
                          ? "Tanyakan bagian yang bikin bingung di catatan ini..."
                          : "Tulis komentar atau jawaban..."
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
          )}
        </div>
      </div>

      {/* Create Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="surface-modal w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Buat Catatan & Checklist Baru</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Judul Catatan
                </label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Ceklis Progress Minggu 1"
                  className="input-field w-full rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as NoteCategory)}
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="checklist">Checklist Progres</option>
                    <option value="meeting">Notulen Diskusi</option>
                    <option value="review">Review Teknis</option>
                    <option value="blocker">Kendala & Solusi</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Fokus Anggota (Opsional)
                  </label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="input-field w-full rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="">Seluruh Tim</option>
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Isi Catatan
                </label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Tulis konteks catatan, keputusan meeting, atau instruksi..."
                  className="input-field w-full rounded-lg px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Daftar Ceklis (1 baris = 1 item)
                </label>
                <textarea
                  rows={4}
                  value={newChecksRaw}
                  onChange={(e) => setNewChecksRaw(e.target.value)}
                  placeholder={"Cek skema tabel mata_kuliah\nReview form tambah tugas\nTest filter terlambat"}
                  className="input-field w-full rounded-lg px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
