"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Database, Download, RefreshCw, Save, Shield, Webhook } from "lucide-react";
import type { DashboardBootstrap } from "@/lib/types";

interface SettingsViewProps {
  data: DashboardBootstrap;
  onDataChange: (next: DashboardBootstrap) => void;
  onSyncGitHub: () => Promise<void>;
  onToast: (msg: string) => void;
}

export default function SettingsView({
  data,
  onDataChange,
  onSyncGitHub,
  onToast,
}: SettingsViewProps) {
  const [projectName, setProjectName] = useState(data.settings.project_name);
  const [githubRepo, setGithubRepo] = useState(data.settings.github_repo);
  const [githubBranch, setGithubBranch] = useState(data.settings.github_branch || "main");
  const [githubToken, setGithubToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [autoSync, setAutoSync] = useState(String(data.settings.auto_sync_seconds));
  const [discordWebhook, setDiscordWebhook] = useState(data.settings.discord_webhook);
  const [webhookUrl, setWebhookUrl] = useState("/api/webhooks/github");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [usernames, setUsernames] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const m of data.members) map[m.id] = m.github_username;
    return map;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhooks/github`);
    }
  }, []);

  async function handleSave(e: React.FormEvent, triggerSyncAfter = false) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName,
          github_repo: githubRepo,
          github_branch: githubBranch,
          github_token: githubToken.trim() || undefined,
          github_webhook_secret: webhookSecret.trim() || undefined,
          auto_sync_seconds: Number(autoSync),
          discord_webhook: discordWebhook,
          members: data.members.map((m) => ({
            id: m.id,
            github_username: usernames[m.id] || "",
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan pengaturan");
      onDataChange(json.data);
      setGithubToken("");
      setWebhookSecret("");
      onToast("Pengaturan berhasil disimpan.");
      if (triggerSyncAfter && githubRepo.trim()) {
        await onSyncGitHub();
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  async function clearSecretField(field: "clear_github_token" | "clear_webhook_secret") {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: true }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      onToast(field === "clear_github_token" ? "GitHub Token dihapus." : "Webhook Secret dihapus.");
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1800);
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadence-pm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast("Backup JSON berhasil diunduh.");
  }

  const isTurso = data.settings.storage_mode === "turso";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Konfigurasi Proyek & Integrasi
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pengaturan Proyek & GitHub</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Mendukung mode hybrid: otomatis memakai <strong className="text-[var(--text-primary)]">Turso Cloud SQLite</strong> saat hosting di Vercel (anti auto-pause) dan <span className="font-mono-code text-xs">data/monitor.db</span> saat dijalankan lokal.
        </p>
      </div>

      {/* Storage Status Banner */}
      <div className="surface-card flex items-start gap-3 rounded-xl p-4 text-xs text-[var(--text-secondary)]">
        <Database
          className={`mt-0.5 h-4 w-4 shrink-0 ${isTurso ? "text-emerald-400" : "text-sky-400"}`}
        />
        <div>
          <p className="font-medium text-[var(--text-primary)]">
            {isTurso
              ? "Mode Penyimpanan: Turso Cloud SQLite (Aktif & Permanen)"
              : "Mode Penyimpanan: SQLite Lokal (pm-dashboard/data/monitor.db)"}
          </p>
          <p className="mt-0.5 leading-relaxed">
            {isTurso
              ? "Database terhubung ke Turso via libSQL. Tidak pernah mati otomatis tiap 7 hari dan siap diakses bersama oleh Boss, Yoga, dan Juli di Vercel."
              : "Saat ini berjalan lokal di laptop. Untuk hosting Vercel, tambahkan TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN di Environment Variables Vercel."}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => handleSave(e, false)} className="space-y-6">
        {/* Repo Config */}
        <div className="surface-card space-y-4 rounded-xl p-6">
          <h2 className="text-sm font-semibold">Integrasi Repository GitHub</h2>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Nama Proyek
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="input-field w-full rounded-lg px-3.5 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Link Repository GitHub Aplikasi Flutter (URL penuh atau owner/repo)
              </label>
              <input
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="https://github.com/username/pengingat-tugas-kuliah"
                className="input-field font-mono-code w-full rounded-lg px-3.5 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Branch Utama
              </label>
              <input
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                placeholder="main"
                className="input-field font-mono-code w-full rounded-lg px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  GitHub Personal Access Token (Opsional untuk repo publik)
                </label>
                {data.settings.has_github_token && (
                  <button
                    type="button"
                    onClick={() => clearSecretField("clear_github_token")}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Hapus token
                  </button>
                )}
              </div>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={
                  data.settings.has_github_token
                    ? "Token tersimpan aman (isi baru untuk mengganti)"
                    : "ghp_xxxxxxxxxxxx"
                }
                className="input-field font-mono-code w-full rounded-lg px-3.5 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Interval Auto-Sync GitHub
              </label>
              <select
                value={autoSync}
                onChange={(e) => setAutoSync(e.target.value)}
                className="input-field w-full rounded-lg px-3 py-2 text-xs"
              >
                <option value="30">Otomatis tiap 30 detik</option>
                <option value="60">Otomatis tiap 60 detik</option>
                <option value="180">Otomatis tiap 3 menit</option>
                <option value="0">Manual / Webhook saja</option>
              </select>
            </div>
          </div>
        </div>

        {/* Real-Time GitHub Webhook Setup (for Vercel) */}
        <div className="surface-card space-y-4 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--accent-text)]" />
            <h2 className="text-sm font-semibold">GitHub Webhook Real-Time (Untuk Hosting Vercel)</h2>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Setelah deploy ke Vercel, buka repository GitHub aplikasi Flutter -&gt;{" "}
            <strong className="text-[var(--text-primary)]">Settings -&gt; Webhooks -&gt; Add webhook</strong>, lalu masukkan Payload URL di bawah (Content type:{" "}
            <span className="font-mono-code">application/json</span>, pilih event{" "}
            <span className="font-mono-code">Pushes</span>,{" "}
            <span className="font-mono-code">Pull requests</span>, dan{" "}
            <span className="font-mono-code">Workflow runs</span>).
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Payload URL Endpoint
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={webhookUrl}
                className="input-field font-mono-code flex-1 rounded-lg px-3.5 py-2 text-xs text-[var(--text-secondary)]"
              />
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-border)]"
              >
                {copiedWebhook ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedWebhook ? "Tersalin" : "Salin URL"}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Webhook Secret (Opsional — untuk verifikasi HMAC-SHA256)
              </label>
              {data.settings.has_webhook_secret && (
                <button
                  type="button"
                  onClick={() => clearSecretField("clear_webhook_secret")}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Hapus secret
                </button>
              )}
            </div>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={
                data.settings.has_webhook_secret
                  ? "Secret aktif (isi baru untuk mengganti)"
                  : "Bebas diisi string rahasia yang sama dengan di GitHub Webhook"
              }
              className="input-field font-mono-code w-full rounded-lg px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        {/* Team GitHub Mapping */}
        <div className="surface-card space-y-4 rounded-xl p-6">
          <div>
            <h2 className="text-sm font-semibold">Mapping Akun GitHub Tim</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Masukkan username GitHub masing-masing agar setiap commit otomatis terhitung ke profil Boss, Yoga, atau Juli.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {data.members.map((m) => (
              <div key={m.id}>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  {m.name} ({m.role})
                </label>
                <input
                  value={usernames[m.id] || ""}
                  onChange={(e) =>
                    setUsernames((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  placeholder={`username_${m.id}`}
                  className="input-field font-mono-code w-full rounded-lg px-3 py-2 text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Optional Discord Webhook */}
        <div className="surface-card space-y-3 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold">Notifikasi Eksternal (Discord Webhook — Opsional)</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Jika diisi, setiap commit baru dari GitHub atau pertanyaan/kendala dari Yoga & Juli juga akan langsung terkirim ke channel Discord tim.
          </p>
          <input
            value={discordWebhook}
            onChange={(e) => setDiscordWebhook(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="input-field font-mono-code w-full rounded-lg px-3.5 py-2 text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={downloadBackup}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            Export Backup JSON
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Simpan
            </button>
            <button
              type="button"
              disabled={saving || !githubRepo.trim()}
              onClick={(e) => handleSave(e, true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Simpan & Test Sync
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
