import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InArgs, type ResultSet } from "@libsql/client";
import type {
  CommentItem,
  DashboardBootstrap,
  GitHubEventItem,
  Member,
  MemberId,
  NoteChecklistItem,
  NoteItem,
  NotificationItem,
  ProjectSettings,
  RubricItem,
  TaskChecklistItem,
  TaskItem,
} from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __cadenceLibsql: Client | undefined;
  // eslint-disable-next-line no-var
  var __cadenceInitPromise: Promise<void> | undefined;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getStorageMode(): "turso" | "local" {
  return process.env.TURSO_DATABASE_URL?.trim() ? "turso" : "local";
}

function getRawClient(): Client {
  if (globalThis.__cadenceLibsql) {
    return globalThis.__cadenceLibsql;
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    globalThis.__cadenceLibsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    });
    return globalThis.__cadenceLibsql;
  }

  // Local SQLite fallback (or ephemeral /tmp on Vercel if Turso env not configured yet)
  const dataDir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbFilePath = path.join(dataDir, "monitor.db").replace(/\\/g, "/");
  globalThis.__cadenceLibsql = createClient({
    url: `file:${dbFilePath}`,
  });
  return globalThis.__cadenceLibsql;
}

export async function getDb(): Promise<Client> {
  const client = getRawClient();
  if (!globalThis.__cadenceInitPromise) {
    globalThis.__cadenceInitPromise = initAndSeed(client).catch((err) => {
      globalThis.__cadenceInitPromise = undefined;
      throw err;
    });
  }
  await globalThis.__cadenceInitPromise;
  return client;
}

export async function query(sql: string, args: InArgs = []): Promise<ResultSet> {
  const db = await getDb();
  return db.execute({ sql, args });
}

function toPlainRows<T>(res: ResultSet): T[] {
  return res.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < res.columns.length; i++) {
      obj[res.columns[i]] = row[i];
    }
    return obj as T;
  });
}

async function initAndSeed(db: Client): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      github_username TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'backend',
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'checklist',
      author_id TEXT NOT NULL REFERENCES members(id),
      assignee_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      assignee_id TEXT,
      is_done INTEGER NOT NULL DEFAULT 0,
      checked_by TEXT,
      checked_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      author_id TEXT NOT NULL REFERENCES members(id),
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'comment',
      is_resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rubric_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES members(id),
      is_done INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS github_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      sha_or_number TEXT NOT NULL,
      title TEXT NOT NULL,
      author_login TEXT NOT NULL,
      member_id TEXT,
      linked_task_code TEXT,
      url TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_tab TEXT NOT NULL DEFAULT 'overview',
      ref_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  const countRes = await db.execute("SELECT COUNT(*) as c FROM members");
  const count = Number(countRes.rows[0]?.[0] ?? 0);
  if (count > 0) return;

  const now = nowIso();

  const defaultSettings: Record<string, string> = {
    project_name: "Aplikasi Pengingat Tugas Kuliah",
    github_repo: "",
    github_token: "",
    github_webhook_secret: "",
    github_branch: "main",
    auto_sync_seconds: "60",
    discord_webhook: "",
    last_sync_at: "",
    last_sync_status: "idle",
    last_sync_message:
      "Belum terhubung ke repository GitHub. Masukkan link repo di halaman Pengaturan.",
    ci_status: "unknown",
    ci_workflow_name: "",
    ci_url: "",
    ci_updated_at: "",
  };

  for (const [k, v] of Object.entries(defaultSettings)) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      args: [k, v],
    });
  }

  const membersSeed: Array<[string, string, string, string, string, string]> = [
    ["boss", "Boss", "PM", "Project Manager", "", "#6366F1"],
    ["yoga", "Yoga", "Backend", "Database & Logic", "", "#0EA5E9"],
    ["juli", "Juli", "Frontend", "UI/UX & Flutter Pages", "", "#10B981"],
  ];
  for (const m of membersSeed) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO members (id, name, role, title, github_username, avatar_color) VALUES (?, ?, ?, ?, ?, ?)",
      args: m,
    });
  }

  const seedTasks: Array<{
    code: string;
    title: string;
    description: string;
    assignee_id: MemberId;
    status: string;
    priority: string;
    category: string;
    due_date: string;
    checklists: string[];
  }> = [
    {
      code: "PM-01",
      title: "Setup repository Flutter & kontrak struktur folder",
      description:
        "Inisialisasi project Flutter dengan folder models/, database/, pages/, widgets/ serta memasang GitHub Actions flutter analyze.",
      assignee_id: "boss",
      status: "in_progress",
      priority: "high",
      category: "management",
      due_date: addDaysIso(2),
      checklists: [
        "Buat repository GitHub khusus aplikasi Flutter",
        "Definisikan kontrak model MataKuliah dan Tugas",
        "Tambahkan workflow .github/workflows/flutter_analyze.yml",
        "Undang Yoga dan Juli sebagai collaborator",
      ],
    },
    {
      code: "BE-01",
      title: "Model Dart & skema sqflite 2 tabel dengan Foreign Key",
      description:
        "Membuat class MataKuliah dan Tugas (fromMap/toMap) serta DatabaseHelper sqflite dengan PRAGMA foreign_keys = ON.",
      assignee_id: "yoga",
      status: "todo",
      priority: "high",
      category: "backend",
      due_date: addDaysIso(4),
      checklists: [
        "Model MataKuliah (id, nama, dosen, hariKuliah)",
        "Model Tugas (id, mataKuliahId, judul, deskripsi, batasWaktu, prioritas, statusSelesai)",
        "Tabel mata_kuliah dengan constraint UNIQUE pada nama",
        "Tabel tugas dengan FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)",
      ],
    },
    {
      code: "BE-02",
      title: "CRUD Mata Kuliah, cek duplikat & proteksi hapus",
      description:
        "Implementasi query insert, update, delete mata kuliah dengan pengecekan nama unik dan larangan hapus jika masih memiliki tugas.",
      assignee_id: "yoga",
      status: "todo",
      priority: "high",
      category: "backend",
      due_date: addDaysIso(6),
      checklists: [
        "Cek nama mata kuliah duplikat (case-insensitive)",
        "Validasi hitung jumlah tugas sebelum deleteMataKuliah()",
        "Return pesan error jelas bila mata kuliah masih punya tugas",
      ],
    },
    {
      code: "BE-03",
      title: "CRUD Tugas, sorting deadline & query 4 filter",
      description:
        "Query tugas terurut dari batas waktu terdekat, filter Semua / Belum Selesai / Selesai / Terlambat, serta toggle status selesai.",
      assignee_id: "yoga",
      status: "todo",
      priority: "high",
      category: "backend",
      due_date: addDaysIso(8),
      checklists: [
        "Sorting ASC berdasarkan batas_waktu",
        "Filter: Semua, Belum Selesai, Selesai, Terlambat",
        "Method toggleStatusTugas(id, isDone)",
        "Method pencarian tugas berdasarkan judul (opsional)",
      ],
    },
    {
      code: "BE-04",
      title: "Query ringkasan Beranda & statistik Detail Mata Kuliah",
      description:
        "Menyediakan data agregasi untuk Beranda (belum selesai, terlambat, 3 tugas terdekat) dan statistik per mata kuliah.",
      assignee_id: "yoga",
      status: "todo",
      priority: "medium",
      category: "backend",
      due_date: addDaysIso(9),
      checklists: [
        "Hitung jumlah tugas belum selesai & terlambat",
        "Ambil 3 tugas aktif dengan deadline paling dekat",
        "Hitung selesai vs total per mata kuliah (contoh: 3 dari 5)",
      ],
    },
    {
      code: "BE-05",
      title: "Notifikasi lokal H-1 deadline (fitur opsional)",
      description:
        "Integrasi flutter_local_notifications untuk menjadwalkan pengingat otomatis 1 hari sebelum batas waktu tugas.",
      assignee_id: "yoga",
      status: "todo",
      priority: "low",
      category: "optional",
      due_date: addDaysIso(13),
      checklists: [
        "Setup permission notifikasi Android",
        "Jadwalkan pengingat H-1 saat tugas dibuat/diubah",
        "Batalkan notifikasi saat tugas selesai atau dihapus",
      ],
    },
    {
      code: "FE-01",
      title: "App Shell, NavigationBar & Tema Terang/Gelap",
      description:
        "Membangun halaman utama dengan NavigationBar (Beranda, Tugas, Mata Kuliah) plus navigasi ke halaman Form dan Detail (minimal 5 halaman).",
      assignee_id: "juli",
      status: "todo",
      priority: "high",
      category: "frontend",
      due_date: addDaysIso(5),
      checklists: [
        "Struktur minimal 5 halaman terpisah di folder pages/",
        "NavigationBar / BottomNavigationBar responsif",
        "Dukungan tema gelap (opsional nilai tambah)",
      ],
    },
    {
      code: "FE-02",
      title: "Halaman Beranda (ringkasan statistik & 3 tugas terdekat)",
      description:
        "Menampilkan kartu jumlah tugas belum selesai, jumlah tugas terlambat, dan 3 tugas dengan batas waktu paling dekat.",
      assignee_id: "juli",
      status: "todo",
      priority: "high",
      category: "frontend",
      due_date: addDaysIso(7),
      checklists: [
        "Kartu ringkasan tugas belum selesai & terlambat",
        "Daftar 3 tugas paling dekat dengan indikator warna",
        "Empty state informatif jika belum ada tugas",
      ],
    },
    {
      code: "FE-03",
      title: "Halaman Daftar Tugas, filter 4 status & warna deadline",
      description:
        "Daftar tugas lengkap dengan Checkbox selesai, filter chip (Semua, Belum Selesai, Selesai, Terlambat), warna oranye H-1, merah terlambat, dan search bar.",
      assignee_id: "juli",
      status: "todo",
      priority: "high",
      category: "frontend",
      due_date: addDaysIso(9),
      checklists: [
        "Filter 4 status: Semua, Belum Selesai, Selesai, Terlambat",
        "Highlight oranye untuk H-1 dan merah untuk terlambat belum selesai",
        "Checkbox selesai langsung update tampilan",
        "Dialog konfirmasi hapus & empty state yang jelas",
      ],
    },
    {
      code: "FE-04",
      title: "Halaman Form Tambah/Edit Tugas & Mata Kuliah (validator)",
      description:
        "Semua form memakai Form & TextFormField dengan validator wajib isi, showDatePicker tidak boleh tanggal lampau, dan dropdown prioritas.",
      assignee_id: "juli",
      status: "todo",
      priority: "high",
      category: "frontend",
      due_date: addDaysIso(10),
      checklists: [
        "Form Mata Kuliah dengan validator wajib & pesan nama duplikat",
        "Form Tugas dengan dropdown mata kuliah, prioritas, dan showDatePicker",
        "Validasi batas waktu tidak boleh tanggal yang sudah lewat",
      ],
    },
    {
      code: "FE-05",
      title: "Halaman Daftar & Detail Mata Kuliah",
      description:
        "Daftar mata kuliah, proteksi dialog hapus dengan pesan alasan jika masih ada tugas, dan halaman detail berisi semua tugas serta progress (contoh: 3 dari 5 tugas selesai).",
      assignee_id: "juli",
      status: "todo",
      priority: "medium",
      category: "frontend",
      due_date: addDaysIso(11),
      checklists: [
        "Daftar mata kuliah beserta dosen dan hari kuliah",
        "Tampilkan alasan jelas saat gagal hapus mata kuliah yang masih punya tugas",
        "Detail mata kuliah dengan ringkasan X dari Y tugas selesai",
      ],
    },
    {
      code: "PM-02",
      title: "Integrasi akhir, uji persistensi, flutter analyze & presentasi",
      description:
        "Gabungkan branch Backend dan Frontend, uji tutup-buka aplikasi penuh di emulator/HP, pastikan 0 error di flutter analyze, dan siapkan pembagian materi presentasi.",
      assignee_id: "boss",
      status: "todo",
      priority: "high",
      category: "management",
      due_date: addDaysIso(14),
      checklists: [
        "Verifikasi flutter analyze menghasilkan 0 error",
        "Uji data tetap tersimpan setelah aplikasi ditutup penuh",
        "Demo lengkap 6 fitur wajib tanpa crash",
        "Briefing penjelasan kode masing-masing untuk presentasi",
      ],
    },
  ];

  const taskIdsByCode: Record<string, number> = {};
  for (const t of seedTasks) {
    const res = await db.execute({
      sql: `INSERT INTO tasks (code, title, description, assignee_id, status, priority, category, due_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.code,
        t.title,
        t.description,
        t.assignee_id,
        t.status,
        t.priority,
        t.category,
        t.due_date,
        now,
        now,
      ],
    });
    const taskId = Number(res.lastInsertRowid);
    taskIdsByCode[t.code] = taskId;
    for (let idx = 0; idx < t.checklists.length; idx++) {
      await db.execute({
        sql: "INSERT INTO task_checklists (task_id, label, is_done, sort_order) VALUES (?, ?, 0, ?)",
        args: [taskId, t.checklists[idx], idx],
      });
    }
  }

  // Seed Notes
  const note1Res = await db.execute({
    sql: `INSERT INTO notes (title, content, category, author_id, assignee_id, is_pinned, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "Checklist Kickoff & Aturan Kerja Tim",
      "Aturan main agar monitoring GitHub berjalan otomatis: setiap kali push kode ke GitHub, sertakan kode tugas di pesan commit (contoh: feat: buat tabel mata_kuliah [BE-01]). Kalau ada bagian yang membingungkan, langsung tulis di kolom komentar di bawah ini atau di detail tugas terkait.",
      "checklist",
      "boss",
      null,
      1,
      now,
      now,
    ],
  });
  const note1 = Number(note1Res.lastInsertRowid);

  const note1Items: Array<[string, MemberId | null]> = [
    ["Hubungkan link repository GitHub Flutter di menu Pengaturan", "boss"],
    ["Isi GitHub username Yoga dan Juli untuk auto-mapping commit", "boss"],
    ["Yoga memahami struktur 2 tabel sqflite (mata_kuliah & tugas)", "yoga"],
    ["Juli memahami wireframe 5 halaman + NavigationBar", "juli"],
    ["Sepakati kontrak model Dart sebelum mulai coding paralel", "boss"],
  ];
  for (let idx = 0; idx < note1Items.length; idx++) {
    await db.execute({
      sql: `INSERT INTO note_checklists (note_id, label, assignee_id, is_done, checked_by, checked_at, sort_order)
            VALUES (?, ?, ?, 0, NULL, NULL, ?)`,
      args: [note1, note1Items[idx][0], note1Items[idx][1], idx],
    });
  }

  const note2Res = await db.execute({
    sql: `INSERT INTO notes (title, content, category, author_id, assignee_id, is_pinned, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "Catatan Teknis: Relasi Foreign Key & Validasi Hapus",
      "Pastikan di sqflite onConfigure menjalankan PRAGMA foreign_keys = ON. Untuk aturan hapus mata kuliah, lakukan query COUNT(*) pada tabel tugas terlebih dahulu sebelum menghapus agar UI bisa menampilkan pesan alasan yang ramah mahasiswa.",
      "review",
      "boss",
      "yoga",
      0,
      now,
      now,
    ],
  });
  const note2 = Number(note2Res.lastInsertRowid);
  const note2Items: Array<[string, MemberId]> = [
    ["Aktifkan PRAGMA foreign_keys = ON di onConfigure", "yoga"],
    ["Test hapus mata kuliah yang masih punya tugas (harus ditolak)", "yoga"],
    ["Tampilkan AlertDialog alasan gagal hapus di UI", "juli"],
  ];
  for (let idx = 0; idx < note2Items.length; idx++) {
    await db.execute({
      sql: `INSERT INTO note_checklists (note_id, label, assignee_id, is_done, checked_by, checked_at, sort_order)
            VALUES (?, ?, ?, 0, NULL, NULL, ?)`,
      args: [note2, note2Items[idx][0], note2Items[idx][1], idx],
    });
  }

  await db.execute({
    sql: `INSERT INTO comments (target_type, target_id, author_id, body, kind, is_resolved, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)`,
    args: [
      "note",
      note1,
      "boss",
      "Silakan Yoga dan Juli tinggalkan komentar di sini atau di masing-masing kartu task jika ada requirement yang masih bingung.",
      "comment",
      now,
    ],
  });

  if (taskIdsByCode["FE-04"]) {
    await db.execute({
      sql: `INSERT INTO comments (target_type, target_id, author_id, body, kind, is_resolved, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [
        "task",
        taskIdsByCode["FE-04"],
        "juli",
        "Contoh pertanyaan: untuk format tanggal batas waktu di database apakah disimpan sebagai ISO string YYYY-MM-DD atau epoch milliseconds agar cocok dengan showDatePicker?",
        "question",
        now,
      ],
    });
  }

  const rubricSeed: Array<[string, string, MemberId]> = [
    ["Syarat Teknis", "Dibuat dengan Flutter & Dart, berjalan di emulator Android atau HP", "boss"],
    ["Syarat Teknis", "Minimal 5 halaman dengan NavigationBar / BottomNavigationBar di halaman utama", "juli"],
    ["Syarat Teknis", "Penyimpanan sqflite dengan tabel mata_kuliah & tugas berelasi Foreign Key", "yoga"],
    ["Syarat Teknis", "Struktur folder dipisah minimal: models, database, dan pages", "boss"],
    ["Syarat Teknis", "Semua form memakai Form dan TextFormField dengan validator", "juli"],
    ["Fitur Wajib", "CRUD Mata Kuliah lengkap (nama wajib diisi & tidak boleh duplikat)", "yoga"],
    ["Fitur Wajib", "CRUD Tugas lengkap (pilih matkul, showDatePicker tidak boleh lampau, prioritas, Checkbox selesai)", "juli"],
    ["Fitur Wajib", "Daftar Tugas urut deadline terdekat, 4 filter (Semua/Belum/Selesai/Terlambat), warna oranye H-1 & merah terlambat", "juli"],
    ["Fitur Wajib", "Detail Mata Kuliah menampilkan semua tugas matkul tsb + jumlah selesai (contoh: 3 dari 5)", "juli"],
    ["Fitur Wajib", "Beranda menampilkan jumlah belum selesai, jumlah terlambat, dan 3 tugas deadline terdekat", "juli"],
    ["Fitur Wajib", "Dialog konfirmasi hapus, proteksi hapus matkul yang masih punya tugas, dan pesan daftar kosong", "yoga"],
    ["Kriteria Selesai", "Aplikasi berjalan tanpa error dan flutter analyze menghasilkan 0 error", "boss"],
    ["Kriteria Selesai", "Data tetap tersimpan setelah aplikasi ditutup penuh lalu dibuka kembali", "yoga"],
    ["Kriteria Selesai", "Semua anggota mampu menjelaskan kode masing-masing saat presentasi", "boss"],
    ["Fitur Tambahan", "Pencarian tugas berdasarkan judul", "juli"],
    ["Fitur Tambahan", "Notifikasi lokal 1 hari sebelum batas waktu (flutter_local_notifications)", "yoga"],
    ["Fitur Tambahan", "Dukungan Mode Gelap (Dark Mode)", "juli"],
  ];

  for (let idx = 0; idx < rubricSeed.length; idx++) {
    await db.execute({
      sql: "INSERT INTO rubric_items (section, title, owner_id, is_done, notes, sort_order) VALUES (?, ?, ?, 0, '', ?)",
      args: [rubricSeed[idx][0], rubricSeed[idx][1], rubricSeed[idx][2], idx],
    });
  }

  const storageLabel = getStorageMode() === "turso" ? "Turso Cloud SQLite" : "SQLite Lokal";
  await db.execute({
    sql: `INSERT INTO notifications (kind, title, message, link_tab, ref_id, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)`,
    args: [
      "system",
      `Workspace monitoring siap (${storageLabel})`,
      "Masukkan link repository GitHub di Pengaturan untuk mengaktifkan auto-sync dan GitHub Webhook real-time.",
      "settings",
      null,
      now,
    ],
  });
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const res = await query("SELECT key, value FROM settings");
  const map: Record<string, string> = {};
  for (const r of toPlainRows<{ key: string; value: string }>(res)) {
    map[r.key] = r.value;
  }
  return map;
}

export async function getPublicSettings(): Promise<ProjectSettings> {
  const m = await getSettingsMap();
  const ci = m.ci_status;
  const ciStatus: ProjectSettings["ci_status"] =
    ci === "success" || ci === "failure" || ci === "in_progress" ? ci : "unknown";

  return {
    project_name: m.project_name || "Aplikasi Pengingat Tugas Kuliah",
    github_repo: m.github_repo || "",
    github_branch: m.github_branch || "main",
    has_github_token: Boolean(m.github_token && m.github_token.trim().length > 0),
    has_webhook_secret: Boolean(
      (process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.trim().length > 0) ||
        (m.github_webhook_secret && m.github_webhook_secret.trim().length > 0)
    ),
    storage_mode: getStorageMode(),
    auto_sync_seconds: Number(m.auto_sync_seconds || "60") || 60,
    discord_webhook: m.discord_webhook || "",
    last_sync_at: m.last_sync_at || "",
    last_sync_status: m.last_sync_status || "idle",
    last_sync_message: m.last_sync_message || "",
    ci_status: ciStatus,
    ci_workflow_name: m.ci_workflow_name || "",
    ci_url: m.ci_url || "",
    ci_updated_at: m.ci_updated_at || "",
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function addNotification(params: {
  kind: NotificationItem["kind"];
  title: string;
  message: string;
  link_tab?: string;
  ref_id?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO notifications (kind, title, message, link_tab, ref_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      params.kind,
      params.title,
      params.message,
      params.link_tab || "overview",
      params.ref_id ?? null,
      nowIso(),
    ]
  );
}

export async function dispatchDiscordNotification(
  title: string,
  description: string
): Promise<void> {
  const settings = await getSettingsMap();
  const url = settings.discord_webhook?.trim();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color: 6514417,
            timestamp: nowIso(),
            footer: { text: "Cadence PM Monitor" },
          },
        ],
      }),
    });
  } catch {
    // Non-blocking external webhook
  }
}

export async function getDashboardBootstrap(): Promise<DashboardBootstrap> {
  const [
    settings,
    membersRes,
    tasksRes,
    taskChecksRes,
    commentsRes,
    eventsRes,
    notesRes,
    noteChecksRes,
    rubricRes,
    notifsRes,
  ] = await Promise.all([
    getPublicSettings(),
    query(
      "SELECT * FROM members ORDER BY CASE id WHEN 'boss' THEN 1 WHEN 'yoga' THEN 2 ELSE 3 END"
    ),
    query("SELECT * FROM tasks ORDER BY id ASC"),
    query("SELECT * FROM task_checklists ORDER BY sort_order ASC, id ASC"),
    query("SELECT * FROM comments ORDER BY created_at ASC, id ASC"),
    query("SELECT * FROM github_events ORDER BY occurred_at DESC LIMIT 80"),
    query("SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC, id DESC"),
    query("SELECT * FROM note_checklists ORDER BY sort_order ASC, id ASC"),
    query("SELECT * FROM rubric_items ORDER BY sort_order ASC, id ASC"),
    query("SELECT * FROM notifications ORDER BY id DESC LIMIT 40"),
  ]);

  const members = toPlainRows<Member>(membersRes);
  const rawTasks = toPlainRows<Omit<TaskItem, "checklists" | "comments" | "linked_events">>(tasksRes);
  const rawTaskChecks = toPlainRows<Omit<TaskChecklistItem, "is_done"> & { is_done: number }>(
    taskChecksRes
  );
  const rawComments = toPlainRows<Omit<CommentItem, "is_resolved"> & { is_resolved: number }>(
    commentsRes
  );
  const rawEvents = toPlainRows<GitHubEventItem>(eventsRes);
  const rawNotes = toPlainRows<
    Omit<NoteItem, "is_pinned" | "checklists" | "comments"> & { is_pinned: number }
  >(notesRes);
  const rawNoteChecks = toPlainRows<Omit<NoteChecklistItem, "is_done"> & { is_done: number }>(
    noteChecksRes
  );
  const rawRubric = toPlainRows<Omit<RubricItem, "is_done"> & { is_done: number }>(rubricRes);
  const rawNotifications = toPlainRows<Omit<NotificationItem, "is_read"> & { is_read: number }>(
    notifsRes
  );

  const taskCheckMap = new Map<number, TaskChecklistItem[]>();
  for (const c of rawTaskChecks) {
    const arr = taskCheckMap.get(Number(c.task_id)) || [];
    arr.push({ ...c, id: Number(c.id), task_id: Number(c.task_id), is_done: Boolean(c.is_done) });
    taskCheckMap.set(Number(c.task_id), arr);
  }

  const taskCommentMap = new Map<number, CommentItem[]>();
  const noteCommentMap = new Map<number, CommentItem[]>();
  for (const cm of rawComments) {
    const parsed: CommentItem = {
      ...cm,
      id: Number(cm.id),
      target_id: Number(cm.target_id),
      is_resolved: Boolean(cm.is_resolved),
    };
    if (cm.target_type === "task") {
      const arr = taskCommentMap.get(parsed.target_id) || [];
      arr.push(parsed);
      taskCommentMap.set(parsed.target_id, arr);
    } else if (cm.target_type === "note") {
      const arr = noteCommentMap.get(parsed.target_id) || [];
      arr.push(parsed);
      noteCommentMap.set(parsed.target_id, arr);
    }
  }

  const eventByTaskCode = new Map<string, GitHubEventItem[]>();
  for (const ev of rawEvents) {
    if (ev.linked_task_code) {
      const code = ev.linked_task_code.toUpperCase();
      const arr = eventByTaskCode.get(code) || [];
      arr.push(ev);
      eventByTaskCode.set(code, arr);
    }
  }

  const tasks: TaskItem[] = rawTasks.map((t) => {
    const id = Number(t.id);
    return {
      ...t,
      id,
      checklists: taskCheckMap.get(id) || [],
      comments: taskCommentMap.get(id) || [],
      linked_events: eventByTaskCode.get(t.code.toUpperCase()) || [],
    };
  });

  const noteCheckMap = new Map<number, NoteChecklistItem[]>();
  for (const nc of rawNoteChecks) {
    const noteId = Number(nc.note_id);
    const arr = noteCheckMap.get(noteId) || [];
    arr.push({
      ...nc,
      id: Number(nc.id),
      note_id: noteId,
      is_done: Boolean(nc.is_done),
    });
    noteCheckMap.set(noteId, arr);
  }

  const notes: NoteItem[] = rawNotes.map((n) => {
    const id = Number(n.id);
    return {
      ...n,
      id,
      is_pinned: Boolean(n.is_pinned),
      checklists: noteCheckMap.get(id) || [],
      comments: noteCommentMap.get(id) || [],
    };
  });

  const rubric: RubricItem[] = rawRubric.map((r) => ({
    ...r,
    id: Number(r.id),
    is_done: Boolean(r.is_done),
  }));

  const notifications: NotificationItem[] = rawNotifications.map((n) => ({
    ...n,
    id: Number(n.id),
    is_read: Boolean(n.is_read),
  }));

  return {
    settings,
    members,
    tasks,
    notes,
    rubric,
    github_events: rawEvents,
    notifications,
  };
}
