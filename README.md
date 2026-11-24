# Cadence PM — Monitoring Proyek Mobile (Neon Postgres + Local SQLite)

Website monitoring dan manajemen proyek untuk tim **Boss (PM)**, **Yoga (Backend)**, dan **Juli (Frontend)** dalam pengembangan **Aplikasi Pengingat Tugas Kuliah (Flutter)**.

Mendukung **mode hybrid otomatis**:
- **Di Vercel (hosting online)**: otomatis terhubung ke **Neon Serverless Postgres** (`DATABASE_URL` dari tab **Storage** Vercel — gratis, auto-wake otomatis <0,5 detik, tidak mati permanen tiap 7 hari).
- **Di laptop (lokal)**: otomatis menyimpan ke file SQLite lokal `data/monitor.db` tanpa perlu env cloud.

## Cara Deploy ke Vercel + Neon Postgres (1-Klik)

1. Import repo `https://github.com/PutuSatria-hash/ReminderSS` di [Vercel](https://vercel.com/new) dan klik **Deploy**.
2. Di halaman proyek Vercel, buka tab **Storage** -> klik **Create Database** -> pilih **Neon (Serverless Postgres)** -> **Continue / Create**.
3. Vercel otomatis menyuntikkan `DATABASE_URL` ke Environment Variables proyek. Klik **Redeploy** satu kali agar aktif.
4. Buka link website Vercel Anda -> pastikan indikator kiri atas menampilkan **Neon Postgres Aktif**.
5. *(Opsional)* Pasang **GitHub Webhook** dari halaman **Pengaturan** ke repo aplikasi Flutter agar setiap push/PR Yoga & Juli masuk otomatis secara real-time.
