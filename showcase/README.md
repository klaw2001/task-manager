# Product showcase video

A 2 min 41 s, 1080p / 30 fps product film of Task Manager — every feature in the app, shown with **real footage of the running product** (not mock-ups), plus a synthesised score and UI sound design.

**Final cut:** [`task-manager-showcase.mp4`](./task-manager-showcase.mp4)

## What's in it

| # | Chapter | Features shown |
|---|---------|----------------|
| – | Hook + title | "Which tasks are overdue? You shouldn't have to ask." |
| 01 | Get started | First-run setup, company + admin, timezone, optional sample data |
| 02 | Dashboard | Overdue-first panel grouped by person, live sidebar badge, counts, next 7 days, blocked work, workload, momentum chart, activity feed |
| 03 | Task list | Overdue banner, groups (Overdue → Due today → Upcoming → No deadline → Completed), inline status/assignee/deadline/priority |
| 04 | Board | Kanban columns, overdue flags, drag & drop status change |
| 05 | Side-peek | Inline editing, status/priority change, comments, change history |
| 06 | New task | `C` shortcut, assign to anyone, quick deadlines, priority/tags |
| 07 | Filters & search | Status/deadline/priority/assignee/tag filters, search, shareable URLs |
| 08 | Notifications & email | Tooltips on icon-only buttons, bell with unread highlighting, assignment email to the new assignee (Brevo SMTP — rendered from the app's real template), daily overdue digest (Vercel Cron) |
| 09 | Company profile | Identity, details, timezone, brand colour that recolours the whole app, member visibility policy |
| 10 | People & roles | Roles, add member + one-time temporary password, forced password change, reset/deactivate, last-admin guard |
| 11 | Teams | Team management, team directory with open/overdue per person |
| 12 | Access control | Admin / Manager / Member permission matrix, server-side enforcement, claim unassigned tasks, personal tasks |
| 13 | Everywhere | Dark mode, mobile layout |
| 14 | Security | bcrypt, signed httpOnly sessions, per-request revalidation, lockout, Row Level Security, server-side authorisation |
| 15 | Under the hood | Next.js 16, React 19, Tailwind v4, Drizzle, PostgreSQL, Vercel deploy + migrations, PGlite local dev, optional Brevo email |

## How it's made (all reproducible)

```
showcase/
  capture/       Playwright scripts that drive the real app and save 2x screenshots (+ element rects)
  composition/   HTML/CSS/JS timeline: every frame is a pure function of time (camera, cursor, callouts…)
  audio/         numpy synth: score + UI sounds, cued from the composition's event list
  render/        parallel frame renderer, event export, ffmpeg encode
```

Prerequisites: Node 22, `npm ci` at the repo root, Playwright (Chromium), Python 3 + numpy, ffmpeg, the Inter font.

```bash
# 1 · footage  (needs `npm run dev` on :3000)
rm -rf .data && npm run dev                      # fresh DB → first-run setup flow
node showcase/capture/capture-a-setup.mjs
showcase/capture/reset-seed.sh                   # seeded demo data, restarts the dev server
node showcase/capture/capture-b1-readonly.mjs    # every screen (read-only)
node showcase/capture/capture-b2-flows.mjs       # interactive flows (changes data)
showcase/capture/reset-seed.sh                   # clean seed again for the additions
npx tsx showcase/capture/render-email.ts         # the real assignment email, from src/lib/email/templates.ts
node showcase/capture/capture-c-additions.mjs    # tooltips + email screenshot

# 2 · composition → frames
node showcase/render/build-manifest.mjs
node showcase/render/frame.mjs 12.5 40           # preview single frames → showcase/out/test/
node showcase/render/render.mjs --workers 4      # 4,740 PNG frames → showcase/frames/

# 3 · sound + final encode
node showcase/render/events.mjs                  # audio cue list from the composition
python3 showcase/audio/synth.py                  # → showcase/audio/mix.wav
showcase/render/encode.sh                        # → showcase/task-manager-showcase.mp4
```

Generated artefacts (`assets/`, `frames/`, `audio/mix.wav`, `out/`) are git-ignored; only the final MP4 is committed.
