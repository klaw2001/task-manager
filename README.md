# Staff Training & Recipe LMS

A small, mobile-first learning system for **Indoventura Foodteck**: staff watch assigned training videos, take assessments, acknowledge SOPs and look up recipes. Admins manage everything in the app — no developer needed for routine changes.

**Stack:** React 19 + Vite · Node 22 + Express 5 · PostgreSQL · S3 for videos · one Docker image · built for AWS ([guide](docs/AWS.md)).

## Run it locally

```bash
cp .env.example .env
docker compose up -d db        # PostgreSQL (or point DATABASE_URL at any Postgres)
npm install
npm run seed                   # demo brands, outlets, users, modules, recipes (never run in production)
npm run dev                    # API on :3000, web app on http://localhost:5173
```

Demo sign-ins (employee ID, password `Demo@1234`):

| ID | Role | Notes |
|---|---|---|
| `ADMIN001` | Super Admin | everything |
| `TRAIN001` | Training Admin | modules, recipes, assignments, reports — not users |
| `INC001` / `INC002` | Outlet In-charge | own training + their outlet's team (Andheri / Bandra) |
| `FR001` | Franchisee | own training + outlets they own (Bandra) |
| `TM001` | Team Member | Andheri, **shift 09:00–18:00** — content locks outside it |
| `TM002`–`TM004` | Team Member | no shift limit (`TM004` is a different brand) |

Admin users in the app: **Users** (add, edit, transfer, remove access), **Outlets**, **Modules**, **Recipes**, **Reports**, **Audit**.

## The three rules you asked for

**1. Content only during the shift.** Each user can have a shift start/end (India time by default, `APP_TIMEZONE`; overnight shifts like 22:00–06:00 work; the end minute is exclusive). Outside it, every training, recipe and video endpoint returns `403 OUTSIDE_SHIFT` and the app shows a "Outside your shift" screen. It's enforced on the server for each request, so a video that is already playing stops at the next chunk (≤ ~2 MB) when the shift ends. Leave the shift blank for no restriction; admins are never restricted. Manager reports are not shift-locked (they are not training content).

**2. No downloading, no screenshots — what is and isn't possible.**
* *Downloads:* videos have **no public URL**; they are streamed by the app only to a signed-in, in-shift, assigned user, in short range responses with `Cache-Control: no-store`. The player hides the download button, Picture-in-Picture and the right-click menu. This stops casual saving; it can't stop someone determined who scripts requests with their own login.
* *Screenshots / screen recording:* **a website cannot block these** — not on iPhone, not on Android, not on desktop. Anything claiming otherwise is misleading. What the app does instead is overlay the viewer's **name and employee ID**, drifting across the video, so a leaked recording or screenshot points back to the person. If you need the operating system to blank the screen (Android `FLAG_SECURE`, iOS screen-capture detection), the app would need wrapping as a native app (e.g. Capacitor); say if you want that.

**3. Admins can remove anyone's access at any time.** **Users → Remove access** signs the person out and blocks sign-in, playback and every API call *immediately* (the account is checked on every request, there is no token to wait out). Their training records stay. **Restore access** reverses it. Removals, resets and transfers are in the audit log.

## How the brief is covered

| Brief | Where |
|---|---|
| Roles + brand/outlet restriction | Server-side on every route (`progress-query.js` `teamScope`, `routes/*`). In-charges see their outlet; franchisees see outlets they own; learners see only their brand/role content |
| Onboarding, transfers, deactivation | **Users** page: name, employee ID, mobile, brand/outlet, designation, manager, joining date, language, shift, deadline. Temporary password shown once, forced change at first sign-in |
| Modules: video, instructions, brands/roles, mandatory/optional, sequence + prerequisite, deadline, assessment, acknowledgement | **Modules → editor** |
| Resume video, lesson ≠ assessment, minimum viewing | Position saved every 10 s; viewing time is *measured* (a heartbeat capped by real elapsed time), so seeking to the end earns nothing |
| MCQ / multi-answer / optional written; pass mark, attempts, randomisation | Auto-marked server-side; the answer key is never sent to the browser |
| Failed + retraining, score/attempts/date | Statuses *Failed*, *Retraining required*; admin **Allow retake**; full per-person history |
| Complete only after lesson + assessment + acknowledgement | Enforced in `routes/learn.js` (`settle`) |
| Recipe library, search, brand/role restriction | **Recipes** — search by name, category or ingredient; replay without assessments |
| Publish/archive, preview, assign to people/groups | Module editor (Preview, Assign tabs) |
| Versions + change history, retrain / re-acknowledge | **Publish new version** (retrain, or fresh acknowledgement only). Progress and attempts are stored per version, so earlier completions stay linked to the version completed |
| Dashboards + reports | Learner dashboard; **Reports** by record / employee / outlet / brand / role, overdue and failed, **CSV download** (opens in Excel) |
| Secure login, session expiry, audit | bcrypt, httpOnly cookie, 8 h sessions, failed-login limits, audit log, protected media |
| Company-controlled hosting + source | Your AWS account, this repository |

**Not in this version** (listed so nothing is assumed): email/SMS/push **reminders** (the dashboard and reports show due/overdue); **OTP / self-service password recovery** (an admin resets the password); real **.xlsx** export (CSV only); PDF/image **attachments** on modules (video + text only; recipes have a plating image); **recipe version history** (edits are in the audit log); **adaptive HLS streaming / CloudFront** (see [docs/AWS.md](docs/AWS.md) §5); multi-language **UI** (content has a language field; the interface is English).

## Layout

```
server/   Express API  (src/routes/*, src/storage.js, migrations/*.sql, scripts/, test/)
client/   React app    (src/pages/*, src/SecureVideo.jsx, src/ShiftGate.jsx)
docs/AWS.md   deployment guide        Dockerfile   one image for API + web
```

## Tests

```bash
createdb lms_test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/lms_test npm test
```
⚠ The test database is **wiped on every run** (the name must end in `_test`). The 19 tests cover shift locking, instant access removal, protected range streaming, tamper-resistant progress, the learner journey, attempt limits, versioning with preserved history, outlet/brand scoping, CSV, audit and first-boot setup.

## Configuration

See [.env.example](.env.example). Production needs `JWT_SECRET`; `STORAGE_DRIVER=s3` + `S3_BUCKET` for videos; `DATABASE_SSL=true` for RDS.
