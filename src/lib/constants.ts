// Shared (client + server) constants. Keep this file free of server-only imports.

export const ROLES = ["ADMIN", "MANAGER", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: "Full access — company profile, people, roles and every task.",
  MANAGER: "Creates and assigns tasks, sees everyone's work. Can't manage people or the company.",
  MEMBER: "Works on assigned tasks: updates status, comments, tracks deadlines.",
};

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Tone = "gray" | "blue" | "purple" | "green" | "red" | "orange" | "yellow" | "pink";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Not started",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  TODO: "gray",
  IN_PROGRESS: "blue",
  IN_REVIEW: "purple",
  BLOCKED: "red",
  DONE: "green",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: "gray",
  MEDIUM: "yellow",
  HIGH: "orange",
  URGENT: "red",
};

/** Who can see tasks that aren't theirs. */
export const VISIBILITIES = ["ALL", "OWN"] as const;
export type MemberVisibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<MemberVisibility, string> = {
  ALL: "Members can see every task in the company",
  OWN: "Members only see tasks assigned to or created by them",
};

export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"] as const;

export const ACCENT_PRESETS = [
  "#4f46e5", // indigo
  "#2563eb", // blue
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#e11d48", // rose
  "#7c3aed", // violet
  "#111827", // ink
] as const;

export const DEFAULT_ACCENT = "#4f46e5";

export const MIN_PASSWORD_LENGTH = 8;
