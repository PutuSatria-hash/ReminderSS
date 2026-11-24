import {
  addNotification,
  dispatchDiscordNotification,
  getSettingsMap,
  nowIso,
  query,
  setSetting,
} from "./db";
import type { Member, MemberId } from "./types";

export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!cleaned) return null;

  const urlMatch = cleaned.match(/github\.com[/:]([^/\s]+)\/([^/\s]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  const slashMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slashMatch) {
    return { owner: slashMatch[1], repo: slashMatch[2] };
  }

  return null;
}

export function extractTaskCode(text: string, validCodes: Set<string>): string | null {
  if (!text) return null;

  const bracketMatches = text.matchAll(/\[([A-Za-z]{2,4}-\d{1,3})\]/g);
  for (const m of bracketMatches) {
    const candidate = m[1].toUpperCase();
    if (validCodes.has(candidate)) return candidate;
  }

  const plainMatches = text.matchAll(/\b([A-Za-z]{2,4}-\d{1,3})\b/g);
  for (const m of plainMatches) {
    const candidate = m[1].toUpperCase();
    if (validCodes.has(candidate)) return candidate;
  }

  return null;
}

function matchMember(
  login: string,
  authorName: string,
  members: Member[]
): MemberId | null {
  const lowerLogin = (login || "").toLowerCase().trim();
  const lowerName = (authorName || "").toLowerCase().trim();

  for (const m of members) {
    const gh = m.github_username.toLowerCase().trim();
    if (gh && (lowerLogin === gh || lowerName === gh)) {
      return m.id;
    }
  }

  for (const m of members) {
    const nameKey = m.name.toLowerCase();
    if (
      (lowerLogin && lowerLogin.includes(nameKey)) ||
      (lowerName && lowerName.includes(nameKey))
    ) {
      return m.id;
    }
  }

  return null;
}

async function loadMembersAndTasks() {
  const [membersRes, tasksRes] = await Promise.all([
    query("SELECT id, name, role, title, github_username, avatar_color FROM members"),
    query("SELECT id, code, status, title FROM tasks"),
  ]);

  const members: Member[] = membersRes.rows.map((r) => ({
    id: String(r.id) as MemberId,
    name: String(r.name),
    role: String(r.role),
    title: String(r.title),
    github_username: String(r.github_username || ""),
    avatar_color: String(r.avatar_color),
  }));

  const tasks = tasksRes.rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    status: String(r.status),
    title: String(r.title),
  }));

  const validCodes = new Set(tasks.map((t) => t.code.toUpperCase()));
  const taskByCode = new Map(tasks.map((t) => [t.code.toUpperCase(), t]));
  return { members, tasks, validCodes, taskByCode };
}

interface GitHubCommitApi {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string };
  };
  author?: { login?: string } | null;
}

interface GitHubPrApi {
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  updated_at: string;
  created_at: string;
  head?: { ref?: string };
  user?: { login?: string } | null;
}

interface GitHubWorkflowResponse {
  workflow_runs?: Array<{
    name?: string;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
    updated_at?: string;
  }>;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  new_commits: number;
  new_prs: number;
  auto_updated_tasks: string[];
  ci_status: string;
}

export async function syncGitHubRepository(): Promise<SyncResult> {
  const settings = await getSettingsMap();
  const repoInput = settings.github_repo || "";
  const parsed = parseGitHubRepo(repoInput);

  if (!parsed) {
    const msg =
      "Link repository GitHub belum diatur atau formatnya tidak valid (gunakan owner/repo atau URL GitHub).";
    await setSetting("last_sync_status", "idle");
    await setSetting("last_sync_message", msg);
    return {
      ok: false,
      message: msg,
      new_commits: 0,
      new_prs: 0,
      auto_updated_tasks: [],
      ci_status: settings.ci_status || "unknown",
    };
  }

  const branch = (settings.github_branch || "main").trim() || "main";
  const token = (settings.github_token || "").trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Cadence-PM-Monitor",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { members, validCodes, taskByCode } = await loadMembersAndTasks();
  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const now = nowIso();

  try {
    const [commitsRes, prsRes, runsRes] = await Promise.all([
      fetch(`${base}/commits?sha=${encodeURIComponent(branch)}&per_page=25`, {
        headers,
        cache: "no-store",
      }),
      fetch(`${base}/pulls?state=all&sort=updated&direction=desc&per_page=15`, {
        headers,
        cache: "no-store",
      }),
      fetch(`${base}/actions/runs?per_page=5`, {
        headers,
        cache: "no-store",
      }),
    ]);

    if (!commitsRes.ok) {
      const errText =
        commitsRes.status === 404
          ? `Repository ${parsed.owner}/${parsed.repo} (branch ${branch}) tidak ditemukan atau bersifat privat (butuh GitHub Token).`
          : commitsRes.status === 403
            ? "Rate limit GitHub API tercapai atau token tidak memiliki akses repo."
            : `GitHub API error (${commitsRes.status}).`;
      await setSetting("last_sync_at", now);
      await setSetting("last_sync_status", "error");
      await setSetting("last_sync_message", errText);
      return {
        ok: false,
        message: errText,
        new_commits: 0,
        new_prs: 0,
        auto_updated_tasks: [],
        ci_status: settings.ci_status || "unknown",
      };
    }

    const commits = (await commitsRes.json()) as GitHubCommitApi[];
    const prs = prsRes.ok ? ((await prsRes.json()) as GitHubPrApi[]) : [];
    const runsData = runsRes.ok ? ((await runsRes.json()) as GitHubWorkflowResponse) : {};

    const existingRes = await query("SELECT id FROM github_events");
    const existingIds = new Set(existingRes.rows.map((r) => String(r.id)));

    let newCommits = 0;
    let newPrs = 0;
    const autoUpdatedTasks = new Set<string>();
    const isInitialImport = existingIds.size === 0;

    for (const c of commits) {
      const eventId = `commit:${c.sha}`;
      const shortSha = c.sha.slice(0, 7);
      const firstLine = (c.commit?.message || "").split("\n")[0].trim() || "(tanpa pesan commit)";
      const login = c.author?.login || c.commit?.author?.name || "unknown";
      const authorName = c.commit?.author?.name || login;
      const memberId = matchMember(login, authorName, members);
      const linkedCode = extractTaskCode(c.commit?.message || "", validCodes);
      const occurredAt = c.commit?.author?.date || now;

      const isNew = !existingIds.has(eventId);
      await query(
        `INSERT INTO github_events
          (id, event_type, sha_or_number, title, author_login, member_id, linked_task_code, url, state, branch, occurred_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          member_id = excluded.member_id,
          linked_task_code = excluded.linked_task_code,
          state = excluded.state,
          synced_at = excluded.synced_at`,
        [
          eventId,
          "commit",
          shortSha,
          firstLine,
          login,
          memberId,
          linkedCode,
          c.html_url,
          "committed",
          branch,
          occurredAt,
          now,
        ]
      );

      if (isNew) {
        newCommits++;
        if (linkedCode) {
          const targetTask = taskByCode.get(linkedCode);
          if (targetTask && (targetTask.status === "todo" || targetTask.status === "in_progress")) {
            await query("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", [
              "in_review",
              now,
              targetTask.id,
            ]);
            targetTask.status = "in_review";
            autoUpdatedTasks.add(linkedCode);
          }
        }

        if (!isInitialImport) {
          const who = memberId ? memberId.toUpperCase() : login;
          const title = linkedCode
            ? `Commit baru untuk [${linkedCode}] oleh ${who}`
            : `Commit baru dari ${who}`;
          await addNotification({
            kind: "github_commit",
            title,
            message: `${shortSha}: ${firstLine}`,
            link_tab: linkedCode ? "tasks" : "github",
            ref_id: linkedCode || shortSha,
          });
          await dispatchDiscordNotification(title, `\`${shortSha}\` — ${firstLine}\n${c.html_url}`);
        }
      }
    }

    for (const pr of prs) {
      const eventId = `pr:${pr.number}`;
      const state = pr.merged_at ? "merged" : pr.state;
      const login = pr.user?.login || "unknown";
      const memberId = matchMember(login, login, members);
      const linkedCode = extractTaskCode(`${pr.title} ${pr.head?.ref || ""}`, validCodes);
      const occurredAt = pr.updated_at || pr.created_at || now;

      const isNew = !existingIds.has(eventId);
      await query(
        `INSERT INTO github_events
          (id, event_type, sha_or_number, title, author_login, member_id, linked_task_code, url, state, branch, occurred_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          member_id = excluded.member_id,
          linked_task_code = excluded.linked_task_code,
          state = excluded.state,
          synced_at = excluded.synced_at`,
        [
          eventId,
          "pr",
          `#${pr.number}`,
          pr.title,
          login,
          memberId,
          linkedCode,
          pr.html_url,
          state,
          pr.head?.ref || "",
          occurredAt,
          now,
        ]
      );

      if (linkedCode) {
        const targetTask = taskByCode.get(linkedCode);
        if (targetTask) {
          if (state === "merged" && targetTask.status !== "done") {
            await query("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", [
              "done",
              now,
              targetTask.id,
            ]);
            targetTask.status = "done";
            autoUpdatedTasks.add(linkedCode);
          } else if (
            state === "open" &&
            (targetTask.status === "todo" || targetTask.status === "in_progress")
          ) {
            await query("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", [
              "in_review",
              now,
              targetTask.id,
            ]);
            targetTask.status = "in_review";
            autoUpdatedTasks.add(linkedCode);
          }
        }
      }

      if (isNew) {
        newPrs++;
        if (!isInitialImport) {
          const who = memberId ? memberId.toUpperCase() : login;
          const title = `Pull Request #${pr.number} (${state}) oleh ${who}`;
          await addNotification({
            kind: "github_pr",
            title,
            message: pr.title,
            link_tab: "github",
            ref_id: String(pr.number),
          });
          await dispatchDiscordNotification(title, `${pr.title}\n${pr.html_url}`);
        }
      }
    }

    let ciStatus = "unknown";
    const latestRun = runsData.workflow_runs?.[0];
    if (latestRun) {
      if (latestRun.status !== "completed") {
        ciStatus = "in_progress";
      } else if (latestRun.conclusion === "success") {
        ciStatus = "success";
      } else {
        ciStatus = "failure";
      }
      const prevCi = settings.ci_status;
      await setSetting("ci_status", ciStatus);
      await setSetting("ci_workflow_name", latestRun.name || "CI Check");
      await setSetting("ci_url", latestRun.html_url || "");
      await setSetting("ci_updated_at", latestRun.updated_at || now);

      if (ciStatus === "failure" && prevCi !== "failure") {
        await addNotification({
          kind: "ci_status",
          title: `CI gagal: ${latestRun.name || "flutter analyze"}`,
          message: "Terdapat error pada pengecekan otomatis GitHub Actions terbaru.",
          link_tab: "github",
          ref_id: latestRun.html_url || null,
        });
      }
    }

    if (isInitialImport && (newCommits > 0 || newPrs > 0)) {
      await addNotification({
        kind: "system",
        title: `Tersinkronisasi dengan ${parsed.owner}/${parsed.repo}`,
        message: `Berhasil memuat ${newCommits} commit dan ${newPrs} Pull Request terbaru.`,
        link_tab: "github",
        ref_id: null,
      });
    }

    const summaryMsg =
      newCommits > 0 || newPrs > 0
        ? `Sinkron selesai: ${newCommits} commit baru, ${newPrs} PR baru.${autoUpdatedTasks.size > 0 ? ` Task diperbarui otomatis: ${Array.from(autoUpdatedTasks).join(", ")}.` : ""}`
        : `Sinkron selesai (${parsed.owner}/${parsed.repo}). Semua aktivitas sudah mutakhir.`;

    await setSetting("last_sync_at", now);
    await setSetting("last_sync_status", "ok");
    await setSetting("last_sync_message", summaryMsg);

    return {
      ok: true,
      message: summaryMsg,
      new_commits: newCommits,
      new_prs: newPrs,
      auto_updated_tasks: Array.from(autoUpdatedTasks),
      ci_status: ciStatus,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? `Gagal menghubungi GitHub: ${err.message}` : "Gagal menghubungi GitHub API.";
    await setSetting("last_sync_at", now);
    await setSetting("last_sync_status", "error");
    await setSetting("last_sync_message", msg);
    return {
      ok: false,
      message: msg,
      new_commits: 0,
      new_prs: 0,
      auto_updated_tasks: [],
      ci_status: settings.ci_status || "unknown",
    };
  }
}

export async function processGitHubWebhookEvent(
  eventName: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; summary: string }> {
  const now = nowIso();
  const { members, validCodes, taskByCode } = await loadMembersAndTasks();

  if (eventName === "ping") {
    const repo = (payload.repository as { full_name?: string } | undefined)?.full_name;
    if (repo) {
      const settings = await getSettingsMap();
      if (!settings.github_repo) {
        await setSetting("github_repo", repo);
      }
      await addNotification({
        kind: "system",
        title: `GitHub Webhook terhubung (${repo})`,
        message: "Event push, PR, dan CI sekarang akan masuk otomatis secara real-time.",
        link_tab: "github",
      });
    }
    return { handled: true, summary: "Webhook ping diterima." };
  }

  if (eventName === "push") {
    const commits = (payload.commits as Array<{
      id: string;
      message: string;
      url: string;
      timestamp?: string;
      author?: { name?: string; username?: string };
    }>) || [];
    const ref = String(payload.ref || "").replace(/^refs\/heads\//, "");
    const pusher = (payload.pusher as { name?: string } | undefined)?.name || "unknown";
    let processed = 0;

    for (const c of commits) {
      const eventId = `commit:${c.id}`;
      const shortSha = c.id.slice(0, 7);
      const firstLine = (c.message || "").split("\n")[0].trim() || "(tanpa pesan commit)";
      const login = c.author?.username || pusher;
      const authorName = c.author?.name || login;
      const memberId = matchMember(login, authorName, members);
      const linkedCode = extractTaskCode(c.message || "", validCodes);
      const occurredAt = c.timestamp || now;

      await query(
        `INSERT INTO github_events
          (id, event_type, sha_or_number, title, author_login, member_id, linked_task_code, url, state, branch, occurred_at, synced_at)
         VALUES (?, 'commit', ?, ?, ?, ?, ?, ?, 'committed', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          member_id = excluded.member_id,
          linked_task_code = excluded.linked_task_code,
          synced_at = excluded.synced_at`,
        [eventId, shortSha, firstLine, login, memberId, linkedCode, c.url, ref, occurredAt, now]
      );
      processed++;

      if (linkedCode) {
        const targetTask = taskByCode.get(linkedCode);
        if (targetTask && (targetTask.status === "todo" || targetTask.status === "in_progress")) {
          await query("UPDATE tasks SET status = 'in_review', updated_at = ? WHERE id = ?", [
            now,
            targetTask.id,
          ]);
          targetTask.status = "in_review";
        }
      }

      const who = memberId ? memberId.toUpperCase() : login;
      const title = linkedCode
        ? `[Webhook] Commit [${linkedCode}] oleh ${who}`
        : `[Webhook] Commit baru dari ${who}`;
      await addNotification({
        kind: "github_commit",
        title,
        message: `${shortSha}: ${firstLine}`,
        link_tab: linkedCode ? "tasks" : "github",
        ref_id: linkedCode || shortSha,
      });
      await dispatchDiscordNotification(title, `\`${shortSha}\` — ${firstLine}\n${c.url}`);
    }

    await setSetting("last_sync_at", now);
    await setSetting("last_sync_status", "ok");
    await setSetting("last_sync_message", `Webhook push real-time: ${processed} commit diterima.`);
    return { handled: true, summary: `Memproses ${processed} commit dari webhook push.` };
  }

  if (eventName === "pull_request") {
    const pr = payload.pull_request as
      | {
          number: number;
          title: string;
          html_url: string;
          state: string;
          merged?: boolean;
          updated_at?: string;
          head?: { ref?: string };
          user?: { login?: string };
        }
      | undefined;
    if (!pr) return { handled: false, summary: "Payload PR kosong." };

    const state = pr.merged ? "merged" : pr.state;
    const login = pr.user?.login || "unknown";
    const memberId = matchMember(login, login, members);
    const linkedCode = extractTaskCode(`${pr.title} ${pr.head?.ref || ""}`, validCodes);

    await query(
      `INSERT INTO github_events
        (id, event_type, sha_or_number, title, author_login, member_id, linked_task_code, url, state, branch, occurred_at, synced_at)
       VALUES (?, 'pr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        state = excluded.state,
        member_id = excluded.member_id,
        linked_task_code = excluded.linked_task_code,
        synced_at = excluded.synced_at`,
      [
        `pr:${pr.number}`,
        `#${pr.number}`,
        pr.title,
        login,
        memberId,
        linkedCode,
        pr.html_url,
        state,
        pr.head?.ref || "",
        pr.updated_at || now,
        now,
      ]
    );

    if (linkedCode) {
      const targetTask = taskByCode.get(linkedCode);
      if (targetTask) {
        if (state === "merged" && targetTask.status !== "done") {
          await query("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?", [
            now,
            targetTask.id,
          ]);
        } else if (state === "open" && (targetTask.status === "todo" || targetTask.status === "in_progress")) {
          await query("UPDATE tasks SET status = 'in_review', updated_at = ? WHERE id = ?", [
            now,
            targetTask.id,
          ]);
        }
      }
    }

    const who = memberId ? memberId.toUpperCase() : login;
    const title = `[Webhook] PR #${pr.number} (${state}) oleh ${who}`;
    await addNotification({
      kind: "github_pr",
      title,
      message: pr.title,
      link_tab: "github",
      ref_id: String(pr.number),
    });
    await dispatchDiscordNotification(title, `${pr.title}\n${pr.html_url}`);
    await setSetting("last_sync_at", now);
    await setSetting("last_sync_status", "ok");
    await setSetting("last_sync_message", `Webhook PR #${pr.number} (${state}) diterima.`);
    return { handled: true, summary: `PR #${pr.number} (${state}) diproses.` };
  }

  if (eventName === "workflow_run") {
    const run = payload.workflow_run as
      | { name?: string; status?: string; conclusion?: string | null; html_url?: string; updated_at?: string }
      | undefined;
    if (!run) return { handled: false, summary: "Payload workflow_run kosong." };

    const ciStatus =
      run.status !== "completed"
        ? "in_progress"
        : run.conclusion === "success"
          ? "success"
          : "failure";

    await setSetting("ci_status", ciStatus);
    await setSetting("ci_workflow_name", run.name || "CI Check");
    await setSetting("ci_url", run.html_url || "");
    await setSetting("ci_updated_at", run.updated_at || now);

    if (ciStatus === "failure") {
      await addNotification({
        kind: "ci_status",
        title: `CI Gagal: ${run.name || "flutter analyze"}`,
        message: "Ada error terdeteksi pada GitHub Actions terbaru.",
        link_tab: "github",
        ref_id: run.html_url || null,
      });
    }
    return { handled: true, summary: `CI status diperbarui ke ${ciStatus}.` };
  }

  return { handled: false, summary: `Event '${eventName}' diabaikan.` };
}
