"use client";

import { useState } from "react";
import { Check, Code2, Copy, FolderTree, Plus } from "lucide-react";
import type { DashboardBootstrap, MemberId } from "@/lib/types";
import { DART_CONTRACT_SNIPPET, getMember } from "./ui-helpers";

interface RubricContractViewProps {
  data: DashboardBootstrap;
  onDataChange: (next: DashboardBootstrap) => void;
  onToast: (msg: string) => void;
}

const SECTIONS = ["Syarat Teknis", "Fitur Wajib", "Kriteria Selesai", "Fitur Tambahan"];

export default function RubricContractView({
  data,
  onDataChange,
  onToast,
}: RubricContractViewProps) {
  const [tab, setTab] = useState<"rubric" | "contract">("rubric");
  const [copiedContract, setCopiedContract] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSection, setNewSection] = useState("Fitur Tambahan");
  const [newOwner, setNewOwner] = useState<MemberId>("boss");

  async function toggleRubric(id: number, nextDone: boolean) {
    const res = await fetch("/api/rubric", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_done: nextDone }),
    });
    const json = await res.json();
    if (res.ok && json.data) onDataChange(json.data);
  }

  async function addRubricItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch("/api/rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: newSection,
        title: newTitle.trim(),
        owner_id: newOwner,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data) {
      onDataChange(json.data);
      setNewTitle("");
      onToast("Item rubrik ditambahkan.");
    }
  }

  function copyContract() {
    navigator.clipboard.writeText(DART_CONTRACT_SNIPPET);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1800);
  }

  const mandatory = data.rubric.filter((r) => r.section !== "Fitur Tambahan");
  const mandatoryDone = mandatory.filter((r) => r.is_done).length;
  const mandatoryPct = mandatory.length
    ? Math.round((mandatoryDone / mandatory.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Standar Penilaian & Arsitektur
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Rubrik Kuliah & Kontrak Teknis
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Pastikan setiap syarat mata kuliah terpenuhi dan Yoga (Backend) serta Juli (Frontend) menggunakan kontrak model Dart yang seragam.
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("rubric")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === "rubric"
                ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Checklist Rubrik ({mandatoryPct}%)
          </button>
          <button
            type="button"
            onClick={() => setTab("contract")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === "contract"
                ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Kontrak Model & Folder
          </button>
        </div>
      </div>

      {tab === "rubric" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SECTIONS.map((sec) => {
              const items = data.rubric.filter((r) => r.section === sec);
              const done = items.filter((r) => r.is_done).length;
              return (
                <div key={sec} className="surface-card rounded-xl p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{sec}</h2>
                    <span className="tabular-nums text-xs text-[var(--text-muted)]">
                      {done}/{items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const owner = getMember(data.members, item.owner_id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleRubric(item.id, !item.is_done)}
                          className="flex w-full items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-3 text-left transition hover:border-[var(--border-strong)]"
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              item.is_done
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-[var(--border-strong)]"
                            }`}
                          >
                            {item.is_done && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs leading-relaxed ${
                                item.is_done
                                  ? "text-[var(--text-muted)] line-through"
                                  : "text-[var(--text-primary)]"
                              }`}
                            >
                              {item.title}
                            </p>
                          </div>
                          {owner && (
                            <span className="shrink-0 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                              {owner.name}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={addRubricItem}
            className="surface-card flex flex-wrap items-center gap-2.5 rounded-xl p-4"
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tambah kriteria ceklis tambahan..."
              className="input-field min-w-[220px] flex-1 rounded-lg px-3 py-2 text-xs"
            />
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              className="input-field rounded-lg px-2.5 py-2 text-xs"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value as MemberId)}
              className="input-field rounded-lg px-2.5 py-2 text-xs"
            >
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="surface-card rounded-xl p-5 lg:col-span-4">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-[var(--accent-text)]" />
              <h2 className="text-sm font-semibold">Pembagian Folder Repo Flutter</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              Pemisahan kepemilikan folder mencegah merge conflict antara Yoga dan Juli saat push ke GitHub.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 font-mono-code text-[11px] leading-relaxed text-[var(--text-secondary)]">
{`lib/
├── main.dart            # Boss + Juli
├── models/              # YOGA (Kontrak Data)
│   ├── mata_kuliah.dart
│   └── tugas.dart
├── database/            # YOGA (sqflite & Query)
│   └── database_helper.dart
├── services/            # YOGA (Notifikasi H-1)
│   └── notification_service.dart
├── pages/               # JULI (Min. 5 Halaman)
│   ├── main_shell_page.dart
│   ├── beranda_page.dart
│   ├── daftar_tugas_page.dart
│   ├── form_tugas_page.dart
│   ├── mata_kuliah_page.dart
│   └── detail_matkul_page.dart
└── widgets/             # JULI (Komponen UI)
    ├── tugas_card.dart
    └── empty_state.dart`}
            </pre>
          </div>

          <div className="surface-card rounded-xl p-5 lg:col-span-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[var(--accent-text)]" />
                <h2 className="text-sm font-semibold">Kontrak Model & Method Repository (Dart)</h2>
              </div>
              <button
                type="button"
                onClick={copyContract}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {copiedContract ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedContract ? "Tersalin" : "Salin Kontrak"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
              Juli bisa membangun semua 5 halaman menggunakan kontrak class ini sejak hari pertama sambil Yoga menyelesaikan implementasi SQLite.
            </p>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 font-mono-code text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {DART_CONTRACT_SNIPPET}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
