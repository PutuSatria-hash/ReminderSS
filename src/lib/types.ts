export type MemberId = "boss" | "yoga" | "juli";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskCategory = "backend" | "frontend" | "management" | "optional";

export type NoteCategory = "checklist" | "meeting" | "review" | "blocker";
export type CommentKind = "comment" | "question" | "blocker" | "answer";
export type CommentTargetType = "task" | "note";

export interface Member {
  id: MemberId;
  name: string;
  role: string;
  title: string;
  github_username: string;
  avatar_color: string;
}

export interface TaskChecklistItem {
  id: number;
  task_id: number;
  label: string;
  is_done: boolean;
  sort_order: number;
}

export interface CommentItem {
  id: number;
  target_type: CommentTargetType;
  target_id: number;
  author_id: MemberId;
  body: string;
  kind: CommentKind;
  is_resolved: boolean;
  created_at: string;
}

export interface GitHubEventItem {
  id: string;
  event_type: "commit" | "pr";
  sha_or_number: string;
  title: string;
  author_login: string;
  member_id: MemberId | null;
  linked_task_code: string | null;
  url: string;
  state: string;
  branch: string;
  occurred_at: string;
  synced_at: string;
}

export interface TaskItem {
  id: number;
  code: string;
  title: string;
  description: string;
  assignee_id: MemberId;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  checklists: TaskChecklistItem[];
  comments: CommentItem[];
  linked_events: GitHubEventItem[];
}

export interface NoteChecklistItem {
  id: number;
  note_id: number;
  label: string;
  assignee_id: MemberId | null;
  is_done: boolean;
  checked_by: MemberId | null;
  checked_at: string | null;
  sort_order: number;
}

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  category: NoteCategory;
  author_id: MemberId;
  assignee_id: MemberId | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  checklists: NoteChecklistItem[];
  comments: CommentItem[];
}

export interface RubricItem {
  id: number;
  section: string;
  title: string;
  owner_id: MemberId;
  is_done: boolean;
  notes: string;
  sort_order: number;
}

export interface NotificationItem {
  id: number;
  kind: "github_commit" | "github_pr" | "question" | "task_review" | "ci_status" | "system";
  title: string;
  message: string;
  link_tab: string;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ProjectSettings {
  project_name: string;
  github_repo: string;
  github_branch: string;
  has_github_token: boolean;
  has_webhook_secret: boolean;
  storage_mode: "turso" | "local";
  auto_sync_seconds: number;
  discord_webhook: string;
  last_sync_at: string;
  last_sync_status: string;
  last_sync_message: string;
  ci_status: "success" | "failure" | "in_progress" | "unknown";
  ci_workflow_name: string;
  ci_url: string;
  ci_updated_at: string;
}

export interface DashboardBootstrap {
  settings: ProjectSettings;
  members: Member[];
  tasks: TaskItem[];
  notes: NoteItem[];
  rubric: RubricItem[];
  github_events: GitHubEventItem[];
  notifications: NotificationItem[];
}
