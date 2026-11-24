"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  FileBarChart2,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  NotebookPen,
  RefreshCw,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { DashboardBootstrap, MemberId } from "@/lib/types";
import GitHubView from "./GitHubView";
import NotesView from "./NotesView";
import OverviewView from "./OverviewView";
import ReportView from "./ReportView";
import RubricContractView from "./RubricContractView";
import SettingsView from "./SettingsView";
import TasksView from "./TasksView";
import { formatRelativeTime, getMember } from "./ui-helpers";

interface DashboardAppProps {
  initialData: DashboardBootstrap;
}

type NavKey = "overview" | "tasks" | "notes" | "github" | "rubric" | "report" | "settings";

export default function DashboardApp({ initialData }: DashboardAppProps) {
  const [data, setData] = useState<DashboardBootstrap>(initialData);
  const [activeTab, setActiveTab] = useState<NavKey>("overview");
  const [activeUser, setActiveUser] = useState<MemberId>("boss");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("cadence-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    const savedUser = localStorage.getItem("cadence-user");
    if (savedUser === "boss" || savedUser === "yoga" || savedUser === "juli") {
      setActiveUser(savedUser);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("cadence-theme", next);
  }

  function switchUser(id: MemberId) {
    setActiveUser(id);
    localStorage.setItem("cadence-user", id);
    const m = getMember(data.members, id);
    showToast(`Aktif sebagai ${m?.name} (${m?.role}).`);
  }

  const syncGitHub = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/github/sync", { method: "POST" });
      const json = await res.json();
      if (json.data) setData(json.data);
      if (json.result?.message) {
        showToast(json.result.message);
      }
    } catch {
      showToast("Gagal menyinkronkan GitHub.");
    } finally {
      setSyncing(false);
    }
  }, [syncing, showToast]);

  // Automatic background GitHub polling when repo is configured
  useEffect(() => {
    const intervalSec = data.settings.auto_sync_seconds;
    if (!data.settings.github_repo || !intervalSec || intervalSec <= 0) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/github/sync", { method: "POST" });
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch {
        // Silent background retry
      }
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [data.settings.github_repo, data.settings.auto_sync_seconds]);

  async function markAllNotificationsRead() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    const json = await res.json();
    if (res.ok && json.data) setData(json.data);
  }

  async function openNotification(id: number, linkTab: string) {
    setNotifOpen(false);
    if (
      linkTab === "overview" ||
      linkTab === "tasks" ||
      linkTab === "notes" ||
      linkTab === "github" ||
      linkTab === "rubric" ||
      linkTab === "report" ||
      linkTab === "settings"
    ) {
      setActiveTab(linkTab);
    }
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (res.ok && json.data) setData(json.data);
  }

  const unreadCount = useMemo(
    () => data.notifications.filter((n) => !n.is_read).length,
    [data.notifications]
  );

  const openQuestionsCount = useMemo(() => {
    let count = 0;
    for (const t of data.tasks) {
      count += t.comments.filter(
        (c) => (c.kind === "question" || c.kind === "blocker") && !c.is_resolved
      ).length;
    }
    for (const n of data.notes) {
      count += n.comments.filter(
        (c) => (c.kind === "question" || c.kind === "blocker") && !c.is_resolved
      ).length;
    }
    return count;
  }, [data.tasks, data.notes]);

  const navItems: Array<{
    key: NavKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard },
    {
      key: "tasks",
      label: "Tugas Tim",
      icon: ListTodo,
      badge: data.tasks.filter((t) => t.status === "in_review").length || undefined,
    },
    {
      key: "notes",
      label: "Notes & Ceklis",
      icon: NotebookPen,
      badge: openQuestionsCount || undefined,
    },
    { key: "github", label: "GitHub Monitor", icon: GitBranch },
    { key: "rubric", label: "Rubrik & Kontrak", icon: ClipboardCheck },
    { key: "report", label: "Laporan Dosen", icon: FileBarChart2 },
    { key: "settings", label: "Pengaturan", icon: Settings },
  ];

  function handleNavigate(tab: string) {
    setActiveTab(tab as NavKey);
    setMobileMenuOpen(false);
  }

  function handleOpenTask(taskId: number) {
    setSelectedTaskId(taskId);
    setActiveTab("tasks");
  }

  function handleOpenTaskByCode(code: string) {
    const found = data.tasks.find((t) => t.code.toUpperCase() === code.toUpperCase());
    if (found) handleOpenTask(found.id);
  }

  function handleOpenNote(noteId: number) {
    setSelectedNoteId(noteId);
    setActiveTab("notes");
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] lg:flex">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-subtle)] px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold tracking-tight text-white">
            CP
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Cadence PM</p>
            <p className="truncate text-[10px] text-[var(--text-muted)]">
              {data.settings.storage_mode === "neon"
                ? "Neon Postgres Cloud"
                : data.settings.storage_mode === "turso"
                  ? "Turso Cloud SQLite"
                  : "Local SQLite"}
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ease-fluid ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="tabular-nums rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active User Switcher (Boss / Yoga / Juli) */}
        <div className="border-t border-[var(--border-subtle)] p-3.5">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Mode Pengguna Aktif
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            {data.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => switchUser(m.id)}
                className={`rounded-md py-1.5 text-[11px] font-medium transition ${
                  activeUser === m.id
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[10px] text-[var(--text-muted)]">
            Komentar & ceklis tercatat atas nama{" "}
            <span className="text-[var(--text-secondary)]">
              {getMember(data.members, activeUser)?.name}
            </span>
            .
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex h-full w-64 flex-col border-r border-[var(--border-strong)] bg-[var(--bg-sidebar)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-4">
              <span className="text-sm font-semibold">Cadence PM</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-[var(--text-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {item.badge && item.badge > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-[var(--border-subtle)] p-3">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-elevated)] p-1">
                {data.members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchUser(m.id)}
                    className={`rounded py-1.5 text-[11px] font-medium ${
                      activeUser === m.id
                        ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Frosted Topbar */}
        <header className="no-print surface-glass sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">
                {data.settings.storage_mode === "neon"
                  ? "Neon Postgres Aktif"
                  : data.settings.storage_mode === "turso"
                    ? "Turso Cloud Aktif"
                    : "SQLite Lokal Aktif"}
              </span>
              {data.settings.github_repo && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="font-mono-code max-w-[200px] truncate text-[11px] text-[var(--text-secondary)]">
                    {data.settings.github_repo}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.settings.github_repo && (
              <button
                type="button"
                onClick={syncGitHub}
                disabled={syncing}
                title="Sinkronkan GitHub sekarang"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              title="Ubah tema gelap / terang"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="surface-modal absolute right-0 mt-2 w-80 overflow-hidden rounded-xl sm:w-96">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                    <span className="text-xs font-semibold">Notifikasi ({unreadCount} baru)</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:underline"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 divide-y divide-[var(--border-subtle)] overflow-y-auto">
                    {data.notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                        Belum ada notifikasi.
                      </div>
                    ) : (
                      data.notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotification(n.id, n.link_tab)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--bg-hover)] ${
                            !n.is_read ? "bg-[var(--accent-soft)]/40" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              !n.is_read ? "bg-[var(--accent)]" : "bg-transparent"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {n.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                              {formatRelativeTime(n.created_at)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8">
          {activeTab === "overview" && (
            <OverviewView
              data={data}
              onNavigate={handleNavigate}
              onOpenTask={handleOpenTask}
              onOpenNote={handleOpenNote}
              onSyncGitHub={syncGitHub}
              syncing={syncing}
            />
          )}

          {activeTab === "tasks" && (
            <TasksView
              data={data}
              activeUser={activeUser}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onDataChange={setData}
              onToast={showToast}
            />
          )}

          {activeTab === "notes" && (
            <NotesView
              data={data}
              activeUser={activeUser}
              selectedNoteId={selectedNoteId}
              onSelectNote={setSelectedNoteId}
              onDataChange={setData}
              onToast={showToast}
            />
          )}

          {activeTab === "github" && (
            <GitHubView
              data={data}
              syncing={syncing}
              onSync={syncGitHub}
              onNavigate={handleNavigate}
              onOpenTaskByCode={handleOpenTaskByCode}
            />
          )}

          {activeTab === "rubric" && (
            <RubricContractView data={data} onDataChange={setData} onToast={showToast} />
          )}

          {activeTab === "report" && <ReportView data={data} onToast={showToast} />}

          {activeTab === "settings" && (
            <SettingsView
              data={data}
              onDataChange={setData}
              onSyncGitHub={syncGitHub}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Subtle Floating Toast */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
