import { z } from "zod";
import {
  COMPANY_SIZES,
  MIN_PASSWORD_LENGTH,
  ROLES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  VISIBILITIES,
} from "./constants";
import { isValidTimezone, isValidYmd } from "./dates";
import { parseTags } from "./utils";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Keep it under ${max} characters`).nullable().optional());

const optUuid = z.preprocess(emptyToNull, z.uuid("Invalid selection").nullable().optional());

const httpUrl = z.preprocess(
  (v) => {
    const s = emptyToNull(v);
    if (typeof s !== "string") return s;
    const t = s.trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  },
  z
    .string()
    .max(500)
    .refine((u) => {
      try {
        const url = new URL(u);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a valid http(s) URL")
    .nullable()
    .optional(),
);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

// bcrypt only uses the first 72 bytes.
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72, "Use at most 72 characters");

export const nameSchema = z.string().trim().min(1, "Name is required").max(80, "Keep it under 80 characters");

// ── Tasks ────────────────────────────────────────────────────────────────
const dueDate = z.preprocess(
  emptyToNull,
  z.string().refine(isValidYmd, "Enter a valid date").nullable().optional(),
);

const tags = z.preprocess(
  (v) => (typeof v === "string" ? parseTags(v) : v),
  z.array(z.string().max(24)).max(8).transform((t) => parseTags(t)).optional(),
);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(160, "Keep the title under 160 characters"),
  description: z.string().max(10_000, "Description is too long").optional().default(""),
  status: z.enum(TASK_STATUSES).optional().default("TODO"),
  priority: z.enum(TASK_PRIORITIES).optional().default("MEDIUM"),
  dueDate,
  assigneeId: optUuid,
  tags,
});

export const taskPatchSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty").max(160).optional(),
  description: z.string().max(10_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate,
  assigneeId: optUuid,
  tags,
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(4000, "Comment is too long"),
});

// ── People & teams ───────────────────────────────────────────────────────
export const userCreateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(ROLES),
  teamId: optUuid,
  jobTitle: optText(80),
  password: z.preprocess(emptyToNull, passwordSchema.nullable().optional()),
});

export const userUpdateSchema = z.object({
  name: nameSchema,
  role: z.enum(ROLES),
  teamId: optUuid,
  jobTitle: optText(80),
});

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(40, "Keep it under 40 characters"),
  description: optText(200),
});

export const profileSchema = z.object({
  name: nameSchema,
  jobTitle: optText(80),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a different password" });

// ── Company ──────────────────────────────────────────────────────────────
export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(80),
  tagline: optText(120),
  description: optText(1000),
  website: httpUrl,
  industry: optText(60),
  size: z.preprocess(emptyToNull, z.enum(COMPANY_SIZES).nullable().optional()),
  foundedYear: z.preprocess(
    (v) => {
      const s = emptyToNull(v);
      return typeof s === "string" ? Number(s) : s;
    },
    z.number().int().min(1800, "Enter a valid year").max(new Date().getFullYear(), "Enter a valid year").nullable().optional(),
  ),
  timezone: z.string().refine(isValidTimezone, "Pick a valid timezone"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour"),
  logoUrl: httpUrl,
  memberVisibility: z.enum(VISIBILITIES),
});

export const setupSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(80),
  timezone: z.string().refine(isValidTimezone, "Pick a valid timezone"),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
