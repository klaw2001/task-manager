import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLES, TASK_PRIORITIES, TASK_STATUSES, VISIBILITIES, DEFAULT_ACCENT } from "../constants";

export const roleEnum = pgEnum("role", ROLES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const visibilityEnum = pgEnum("member_visibility", VISIBILITIES);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Single-tenant: exactly one row. */
export const company = pgTable("company", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  website: text("website"),
  industry: text("industry"),
  size: text("size"),
  foundedYear: integer("founded_year"),
  timezone: text("timezone").notNull().default("UTC"),
  accentColor: text("accent_color").notNull().default(DEFAULT_ACCENT),
  logoUrl: text("logo_url"),
  memberVisibility: visibilityEnum("member_visibility").notNull().default("ALL"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("MEMBER"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    jobTitle: text("job_title"),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    /** Bumped on password reset / deactivation to invalidate outstanding sessions. */
    sessionVersion: integer("session_version").notNull().default(0),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("users_team_idx").on(t.teamId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    /** Calendar date in the company timezone. */
    dueDate: date("due_date", { mode: "string" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    completedAt: ts("completed_at"),
    /** Set once the daily cron has told the assignee this task is overdue. */
    overdueNotifiedAt: ts("overdue_notified_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_status_idx").on(t.status),
    index("tasks_due_idx").on(t.dueDate),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    editedAt: ts("edited_at"),
  },
  (t) => [index("comments_task_idx").on(t.taskId, t.createdAt)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** created | status | assignee | due | priority | title | description | tags | comment */
    type: text("type").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("activities_task_idx").on(t.taskId, t.createdAt), index("activities_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** assigned | comment | status | overdue */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export type DbUser = typeof users.$inferSelect;
export type DbTask = typeof tasks.$inferSelect;
export type DbCompany = typeof company.$inferSelect;
