import type {
  CommentKind,
  DashboardBootstrap,
  Member,
  MemberId,
  NoteCategory,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

export const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; badgeBg: string; badgeText: string }
> = {
  todo: {
    label: "Belum Dikerjakan",
    dot: "#71717A",
    badgeBg: "rgba(113, 113, 122, 0.14)",
    badgeText: "#A1A1AA",
  },
  in_progress: {
    label: "Dikerjakan",
    dot: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.12)",
    badgeText: "#38BDF8",
  },
  in_review: {
    label: "Menunggu Review",
    dot: "#F59E0B",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    badgeText: "#F59E0B",
  },
  done: {
    label: "Selesai",
    dot: "#10B981",
    badgeBg: "rgba(16, 185, 129, 0.14)",
    badgeText: "#10B981",
  },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "Tinggi", color: "#F43F5E" },
  medium: { label: "Sedang", color: "#F59E0B" },
  low: { label: "Rendah", color: "#71717A" },
};

export const NOTE_CATEGORY_META: Record<NoteCategory, { label: string; color: string }> = {
  checklist: { label: "Checklist Progres", color: "#6366F1" },
  meeting: { label: "Notulen Diskusi", color: "#38BDF8" },
  review: { label: "Review Teknis", color: "#10B981" },
  blocker: { label: "Kendala & Solusi", color: "#F43F5E" },
};

export const COMMENT_KIND_META: Record<
  CommentKind,
  { label: string; color: string; bg: string }
> = {
  comment: {
    label: "Komentar",
    color: "#9CA3AF",
    bg: "rgba(156, 163, 175, 0.12)",
  },
  question: {
    label: "Bingung / Tanya",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.14)",
  },
  blocker: {
    label: "Kendala",
    color: "#F43F5E",
    bg: "rgba(244, 63, 94, 0.14)",
  },
  answer: {
    label: "Arahan PM",
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.14)",
  },
};

export function getMember(members: Member[], id: MemberId | string | null): Member | undefined {
  if (!id) return undefined;
  return members.find((m) => m.id === id);
}

export function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return "-";
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Belum pernah";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export function getDueState(
  dueDate: string | null,
  status: TaskStatus
): "done" | "overdue" | "soon" | "normal" | "none" {
  if (!dueDate) return "none";
  if (status === "done") return "done";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "soon";
  return "normal";
}

export function generateMarkdownReport(data: DashboardBootstrap): string {
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalTasks = data.tasks.length;
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const mandatoryRubric = data.rubric.filter((r) => r.section !== "Fitur Tambahan");
  const mandatoryDone = mandatoryRubric.filter((r) => r.is_done).length;
  const rubricPct = mandatoryRubric.length
    ? Math.round((mandatoryDone / mandatoryRubric.length) * 100)
    : 0;

  const lines: string[] = [
    `# Laporan Progres Proyek — ${data.settings.project_name}`,
    ``,
    `- **Tanggal Laporan:** ${today}`,
    `- **Repository GitHub:** ${data.settings.github_repo || "Belum terhubung"}`,
    `- **Status CI (flutter analyze):** ${data.settings.ci_status.toUpperCase()}`,
    `- **Progres Tugas:** ${doneTasks}/${totalTasks} selesai (${pct}%)`,
    `- **Kesiapan Syarat Wajib Kuliah:** ${mandatoryDone}/${mandatoryRubric.length} terpenuhi (${rubricPct}%)`,
    ``,
    `## 1. Ringkasan Kontribusi Tim`,
    ``,
    `| Anggota | Peran | Tugas Selesai | Total Tugas | Commit GitHub |`,
    `| :--- | :--- | :---: | :---: | :---: |`,
  ];

  for (const m of data.members) {
    const memberTasks = data.tasks.filter((t) => t.assignee_id === m.id);
    const memberDone = memberTasks.filter((t) => t.status === "done").length;
    const commits = data.github_events.filter(
      (e) => e.event_type === "commit" && e.member_id === m.id
    ).length;
    lines.push(`| ${m.name} | ${m.title} | ${memberDone} | ${memberTasks.length} | ${commits} |`);
  }

  lines.push(``, `## 2. Daftar Status Tugas`, ``);
  for (const t of data.tasks) {
    const member = getMember(data.members, t.assignee_id)?.name || t.assignee_id;
    const statusLabel = STATUS_META[t.status].label;
    lines.push(
      `- **[${t.code}] ${t.title}** — *${member}* | Status: \`${statusLabel}\` | Tenggat: ${t.due_date || "-"}`
    );
  }

  lines.push(``, `## 3. Catatan & Checklist PM`, ``);
  for (const n of data.notes) {
    const cDone = n.checklists.filter((c) => c.is_done).length;
    lines.push(`### ${n.title} (${cDone}/${n.checklists.length} ceklis)`);
    if (n.content) lines.push(n.content);
    for (const item of n.checklists) {
      lines.push(`- [${item.is_done ? "x" : " "}] ${item.label}`);
    }
    lines.push(``);
  }

  lines.push(`## 4. Pemenuhan Rubrik Kuliah`, ``);
  for (const r of data.rubric) {
    lines.push(`- [${r.is_done ? "x" : " "}] (${r.section}) ${r.title}`);
  }

  return lines.join("\n");
}

export const FLUTTER_CI_WORKFLOW = `name: Flutter Analyze Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          channel: stable
      - run: flutter pub get
      - run: flutter analyze
`;

export const DART_CONTRACT_SNIPPET = `// Kontrak Model Bersama (Yoga: Backend, Juli: Frontend)
// File: lib/models/mata_kuliah.dart
class MataKuliah {
  final int? id;
  final String nama;
  final String dosen;
  final String hariKuliah;

  const MataKuliah({
    this.id,
    required this.nama,
    required this.dosen,
    required this.hariKuliah,
  });
}

// File: lib/models/tugas.dart
enum PrioritasTugas { rendah, sedang, tinggi }

class Tugas {
  final int? id;
  final int mataKuliahId;
  final String judul;
  final String deskripsi;
  final DateTime batasWaktu; // Disimpan ISO-8601 (YYYY-MM-DD) di SQLite
  final PrioritasTugas prioritas;
  final bool statusSelesai;

  const Tugas({
    this.id,
    required this.mataKuliahId,
    required this.judul,
    required this.deskripsi,
    required this.batasWaktu,
    required this.prioritas,
    this.statusSelesai = false,
  });
}

// Kontrak Method DatabaseHelper (lib/database/database_helper.dart)
// - Future<List<MataKuliah>> getAllMataKuliah()
// - Future<int> insertMataKuliah(MataKuliah mk)       // Throw jika nama duplikat
// - Future<int> updateMataKuliah(MataKuliah mk)
// - Future<void> deleteMataKuliah(int id)             // Throw jika masih ada tugas
// - Future<List<Tugas>> getTugas({String filter, String? query, int? mataKuliahId})
// - Future<int> insertTugas(Tugas tugas)
// - Future<int> updateTugas(Tugas tugas)
// - Future<void> toggleSelesai(int tugasId, bool selesai)
// - Future<void> deleteTugas(int id)
// - Future<Map<String, dynamic>> getBerandaSummary()  // belumSelesai, terlambat, top3`;
