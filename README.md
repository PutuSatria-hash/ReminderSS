# Cadence PM — Monitoring Proyek Mobile (Hybrid SQLite + Turso + Vercel)

Website monitoring dan manajemen proyek untuk tim **Boss (PM)**, **Yoga (Backend)**, dan **Juli (Frontend)** dalam pengembangan **Aplikasi Pengingat Tugas Kuliah (Flutter)**.

Mendukung **mode hybrid** menggunakan `@libsql/client`:
- **Di laptop (lokal)**: otomatis menyimpan ke file lokal `data/monitor.db` tanpa perlu env cloud.
- **Di Vercel (hosting online)**: otomatis terhubung ke **Turso Cloud SQLite** (gratis, tidak pernah auto-pause manual tiap 7 hari seperti Supabase).

## Fitur Utama

1. **Ringkasan & Pulse Tim**: Progres tugas, persentase syarat wajib kuliah, kartu kontribusi anggota, antrean pertanyaan tim, dan status CI `flutter analyze`.
2. **Pembagian Tugas (List & Board)**: CRUD tugas, ceklis sub-pekerjaan, bukti commit/PR GitHub otomatis, serta diskusi & pertanyaan per tugas.
3. **Notes & Checklist PM**: Buat catatan meeting/review, centang item yang sudah dikerjakan Yoga atau Juli, dan tampung komentar bagian yang membingungkan langsung di catatan terkait.
4. **GitHub Auto-Monitor & Real-Time Webhook**:
   - Endpoint webhook siap pakai: `POST /api/webhooks/github` (mendukung verifikasi HMAC-SHA256).
   - Sertakan tag kode tugas di pesan commit (contoh: `feat: buat tabel mata_kuliah [BE-01]`) agar status tugas otomatis berpindah ke *Menunggu Review* (atau *Selesai* saat PR di-merge).
5. **Rubrik Kuliah & Kontrak Teknis**: Checklist syarat dosen + kontrak model Dart & pembagian folder agar Backend dan Frontend tidak bentrok.
6. **Laporan Dosen**: Export laporan progres ke Markdown (`.md`) atau cetak/simpan PDF.

## Menjalankan Secara Lokal

```bash
cd pm-dashboard
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Cara Deploy ke Vercel + Turso (Anti Auto-Pause)

1. **Buat Database Gratis di Turso (`https://turso.tech`)**:
   - Login dengan GitHub -> klik **Create Database** (misal nama: `cadence-pm`).
   - Salin **Database URL** (`libsql://...turso.io`) dan klik **Create Token** untuk mendapatkan **Auth Token**.
2. **Push folder `pm-dashboard` ke Repository GitHub**.
3. **Import Repository di Vercel (`https://vercel.com/new`)**:
   - Jika repo berisi folder `pm-dashboard`, atur **Root Directory** ke `pm-dashboard` (atau langsung root jika repo khusus dashboard).
   - Tambahkan **Environment Variables**:
     - `TURSO_DATABASE_URL` = URL database Turso
     - `TURSO_AUTH_TOKEN` = Auth Token Turso
     - `GITHUB_WEBHOOK_SECRET` = *(opsional)* kata sandi bebas untuk verifikasi webhook
   - Klik **Deploy**.
4. **Aktifkan Real-Time GitHub Webhook di Repo Flutter**:
   - Buka repo Flutter -> **Settings -> Webhooks -> Add webhook**.
   - Payload URL: `https://<domain-vercel-anda>/api/webhooks/github`
   - Content type: `application/json`
   - Secret: samakan dengan `GITHUB_WEBHOOK_SECRET` (jika diisi)
   - Events: pilih **Let me select individual events** -> centang `Pushes`, `Pull requests`, dan `Workflow runs`.
