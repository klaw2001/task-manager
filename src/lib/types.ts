import type { MemberVisibility, Role, TaskPriority, TaskStatus } from "./constants";

export type UserLite = {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  active: boolean;
};

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** YYYY-MM-DD in the company timezone, or null. */
  dueDate: string | null;
  tags: string[];
  assignee: UserLite | null;
  createdById: string;
  commentCount: number;
  completedAt: string | null;
  createdAt: string;
};

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; name: string } | null;
};

export type ActivityView = {
  id: string;
  type: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

export type TaskDetail = TaskRow & {
  description: string;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
  comments: CommentView[];
  activity: ActivityView[];
};

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CompanyView = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  foundedYear: number | null;
  timezone: string;
  accentColor: string;
  logoUrl: string | null;
  memberVisibility: MemberVisibility;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
};

export type ActionResult<T = void> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
