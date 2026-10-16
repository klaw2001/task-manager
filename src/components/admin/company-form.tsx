"use client";

import { useState, type FormEvent } from "react";
import { ACCENT_PRESETS, COMPANY_SIZES, VISIBILITIES, VISIBILITY_LABEL, type MemberVisibility } from "@/lib/constants";
import { updateCompany } from "@/lib/actions/people";
import { TIMEZONES } from "@/lib/timezones";
import type { CompanyView } from "@/lib/types";
import { cn, readableOn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { CompanyMark } from "@/components/layout/brand";

export function CompanyForm({ company }: { company: CompanyView }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({
    name: company.name,
    tagline: company.tagline ?? "",
    description: company.description ?? "",
    website: company.website ?? "",
    industry: company.industry ?? "",
    size: company.size ?? "",
    foundedYear: company.foundedYear ? String(company.foundedYear) : "",
    timezone: company.timezone,
    accentColor: company.accentColor,
    logoUrl: company.logoUrl ?? "",
    memberVisibility: company.memberVisibility as MemberVisibility,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => updateCompany(v), { onDone: (r) => setErrors(r.ok ? {} : (r.fieldErrors ?? {})) });
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-10">
        <Section title="Identity" description="How your company appears across the app.">
          <Field label="Company name" htmlFor="c-name" error={errors.name}>
            <Input id="c-name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} />
          </Field>
          <Field label="Tagline" htmlFor="c-tag" error={errors.tagline}>
            <Input id="c-tag" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder="One line on what you do" />
          </Field>
          <Field label="About" htmlFor="c-desc" error={errors.description}>
            <Textarea id="c-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} className="min-h-28" placeholder="Mission, values, how the team works…" />
          </Field>
          <Field label="Logo URL" htmlFor="c-logo" error={errors.logoUrl} hint="Link to a square image (PNG/SVG). Leave empty to use your initial.">
            <Input id="c-logo" value={v.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.png" inputMode="url" />
          </Field>
        </Section>

        <Section title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" htmlFor="c-web" error={errors.website}>
              <Input id="c-web" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="acme.com" inputMode="url" />
            </Field>
            <Field label="Industry" htmlFor="c-ind" error={errors.industry}>
              <Input id="c-ind" value={v.industry} onChange={(e) => set("industry", e.target.value)} maxLength={60} placeholder="e.g. Design agency" />
            </Field>
            <Field label="Company size" htmlFor="c-size" error={errors.size}>
              <Select id="c-size" value={v.size} onChange={(e) => set("size", e.target.value)}>
                <option value="">—</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} people
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Founded" htmlFor="c-year" error={errors.foundedYear}>
              <Input id="c-year" value={v.foundedYear} onChange={(e) => set("foundedYear", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="2021" />
            </Field>
          </div>
        </Section>

        <Section title="Workspace preferences">
          <Field
            label="Timezone"
            htmlFor="c-tz"
            error={errors.timezone}
            hint="Deadlines are calendar dates. “Overdue” starts at midnight in this timezone."
          >
            <Select id="c-tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted">Brand colour</legend>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("accentColor", c)}
                  aria-label={`Use ${c}`}
                  aria-pressed={v.accentColor.toLowerCase() === c}
                  className={cn("size-7 rounded-full border-2 border-transparent ring-offset-2 ring-offset-bg", v.accentColor.toLowerCase() === c && "ring-2 ring-fg")}
                  style={{ background: c }}
                />
              ))}
              <label className="ml-1 flex items-center gap-2 text-xs text-muted">
                Custom
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(v.accentColor) ? v.accentColor : "#4f46e5"}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
              </label>
            </div>
            {errors.accentColor && <p className="text-xs text-danger">{errors.accentColor}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted">Task visibility for members</legend>
            {VISIBILITIES.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input
                  type="radio"
                  name="visibility"
                  checked={v.memberVisibility === opt}
                  onChange={() => set("memberVisibility", opt)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  {VISIBILITY_LABEL[opt]}
                  <span className="block text-xs text-muted">
                    {opt === "ALL" ? "Transparent by default — good for small teams." : "Managers and admins still see everything."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending || !v.name.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs font-medium text-muted">Preview</p>
        <div
          className="space-y-4 rounded-xl border bg-sidebar p-4"
          style={{ ["--accent" as string]: v.accentColor, ["--accent-fg" as string]: readableOn(v.accentColor) }}
        >
          <div className="flex items-center gap-2.5">
            <CompanyMark name={v.name || "?"} logoUrl={v.logoUrl || null} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{v.name || "Your company"}</p>
              <p className="truncate text-xs text-muted">{v.tagline || "Task manager"}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="rounded-md bg-hover px-2 py-1.5 text-sm font-medium">
              <span className="text-accent">●</span> Dashboard
            </div>
            <div className="px-2 py-1.5 text-sm text-muted">Tasks</div>
          </div>
          <div className="rounded-md bg-accent px-3 py-1.5 text-center text-sm font-medium text-accent-fg">New task</div>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
