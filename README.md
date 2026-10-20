# Staff Training & Recipe LMS

A small, mobile-first learning system for **Indoventura Foodteck**: staff watch assigned training videos, take assessments, acknowledge SOPs and look up recipes. Admins manage everything in the app — no developer needed for routine changes.

**Stack:** React 19 + Vite · Node 22 + Express 5 · PostgreSQL · **Bunny Stream** (video, HLS) · **Brevo SMTP** (email) · S3 (PDFs, images) · one Docker image · built for AWS ([guide](docs/AWS.md)).

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

**Video and email stay off until you add credentials** — text lessons, PDFs, images, assessments and recipes work without them:

* Video → Bunny Stream settings in `.env`, see **[docs/BUNNY.md](docs/BUNNY.md)**; verify with `npm run bunny:check`.
* Email → Brevo SMTP settings in `.env`, see **[docs/EMAIL.md](docs/EMAIL.md)**; verify with *Email → Send test* in the app.

Admin screens: **Users** (add, edit, transfer, remove access), **Outlets**, **Modules**, **Recipes**, **Reports**, **Email**, **Audit**.

## The three rules you asked for

**1. Content only during the shift.** Each user can have a shift start/end (India time by default, `APP_TIMEZONE`; overnight shifts like 22:00–06:00 work; the end minute is exclusive). Outside it, every training, recipe, attachment and video-URL endpoint returns `403 OUTSIDE_SHIFT`, and the app shows an "Outside your shift" screen within a minute and tears the video player down. Because video now streams straight from Bunny's CDN, a video that is *already playing* when the shift ends stops when its signed URL expires (default **10 minutes**, `BUNNY_TOKEN_TTL_SECONDS`; lower it to tighten). Leave the shift blank for no restriction; admins are never restricted. Manager reports are not shift-locked.

**2. No downloading, no screenshots — what is and isn't possible.**
* *Downloads:* videos have **no file URL** — the page only ever sees a signed, short-lived HLS playlist, and the player hides download, Picture-in-Picture and right-click. PDFs are drawn page-by-page on a canvas (no browser PDF toolbar with Download/Print); images and PDFs are served with no-store headers. This stops casual saving; it can't stop someone determined who scripts requests with their own login or photographs the screen.
* *Screenshots / screen recording:* **a website cannot block these** — not on iPhone, not on Android, not on desktop. The app instead overlays the viewer's **name and employee ID** (drifting over video, on every PDF page and image) so a leaked recording or screenshot points back to the person. If you need the OS to blank the screen (Android `FLAG_SECURE`, iOS capture detection), the app would have to be wrapped as a native app (e.g. Capacitor); say if you want that.

**3. Admins can remove anyone's access at any time.** **Users → Remove access** signs the person out and blocks sign-in, every API call and every new video URL *immediately* (the account is checked on every request). A video already playing continues only until its signed URL expires (see rule 1). Their training records stay; **Restore access** reverses it. Removals, resets and transfers are in the audit log.

## Video, attachments and email

* **Video → Bunny Stream.** Admins upload from the browser straight to Bunny (resumable); Bunny converts to HLS so it adapts to slow connections. A module/recipe can't be published until its video is *Ready to stream*; the length comes from Bunny. Lesson videos, recipe videos and video attachments all work this way.
* **Attachments.** Modules and recipes can have **PDF, image and video** attachments (add/rename/remove in the editor; shown under the lesson). PDFs and images live in the private S3 bucket and are served only through the app's access checks; videos go to Bunny. Attachments are part of each module version's snapshot.
* **Email → Brevo SMTP.** Optional login-details and password-reset emails, plus **reminders**: new training, due in 3 days, overdue (every 3 days, up to 5), retraining required — one digest per person per kind, 08:00–20:00 India time, each sent once. Needs an email address on the user.

## How the brief is covered

| Brief | Where |
|---|---|
| Roles + brand/outlet restriction | Server-side on every route (`progress-query.js` `teamScope`, `access.js`, `routes/*`). In-charges see their outlet; franchisees see outlets they own; learners see only their brand/role content |
| Onboarding, transfers, deactivation | **Users** page: name, employee ID, mobile, email, brand/outlet, designation, manager, joining date, language, shift, deadline. Temporary password shown once (optionally emailed), forced change at first sign-in |
| Modules: video, instructions, **PDF/image/video attachments**, brands/roles, mandatory/optional, sequence + prerequisite, deadline, assessment, acknowledgement | **Modules → editor** |
| Resume video, lesson ≠ assessment, minimum viewing | Position saved every 10 s; viewing time is *measured* (a heartbeat capped by real elapsed time), so seeking to the end earns nothing |
| MCQ / multi-answer / optional written; pass mark, attempts, randomisation | Auto-marked server-side; the answer key is never sent to the browser |
| Failed + retraining, score/attempts/date | Statuses *Failed*, *Retraining required*; admin **Allow retake**; full per-person history |
| Complete only after lesson + assessment + acknowledgement | Enforced in `routes/learn.js` (`settle`) |
| Recipe library, search, brand/role restriction | **Recipes** — search by name, category or ingredient; video, plating image and attachments; replay without assessments |
| Publish/archive, preview, assign to people/groups | Module editor (Preview, Assign tabs) |
| Versions + change history, retrain / re-acknowledge | **Publish new version** (retrain, or fresh acknowledgement only). Progress and attempts are stored per version; each version snapshots the content, video and attachments it used |
| Dashboards + reports | Learner dashboard; **Reports** by record / employee / outlet / brand / role, overdue and failed, **CSV download** (opens in Excel) |
| New-training, deadline and overdue reminders | Brevo email reminders (above) + dashboard/report badges |
| Reliable streaming on slow connections | Bunny HLS (adaptive quality) |
| Secure login, session expiry, audit | bcrypt, httpOnly cookie, 8 h sessions, failed-login limits, audit log, signed media URLs |
| Company-controlled hosting + source | Your AWS account, your Bunny and Brevo accounts, this repository |

**Not in this version** (so nothing is assumed): **OTP / self-service password recovery** (an admin resets the password); real **.xlsx** export (CSV only); **recipe version history** (edits are in the audit log; modules are versioned); a manager digest of their team's overdue training (staff get their own reminders); DRM / forensic watermarking (the visible name watermark is the deterrent); multi-language **UI** (content has a language field; the interface is English); SMS / push notifications.

**Not yet verified against your real accounts:** Bunny Stream and Brevo. Both are built from their documentation and tested end to end against stand-ins (an upload-signature + token-checking Bunny stand-in with real HLS played in Chromium, and a real SMTP server that requires login). Run `npm run bunny:check` and *Email → Send test* once the credentials are in. The Docker build and AWS deployment steps are also untested here.

## Layout

```
server/   Express API  (src/routes/*, bunny.js, mailer.js, reminders.js, storage.js, migrations/*.sql, scripts/, test/)
client/   React app    (src/pages/*, SecureVideo.jsx, PdfViewer.jsx, Attachments*.jsx, VideoUpload.jsx, ShiftGate.jsx)
docs/     AWS.md · BUNNY.md · EMAIL.md        Dockerfile   one image for API + web
```

## Tests

```bash
createdb lms_test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/lms_test npm test
```
⚠ The test database is **wiped on every run** (the name must end in `_test`). The 36 tests cover shift locking, instant access removal, the Bunny upload signature and signed-URL gating (via a stand-in Bunny that checks tokens by Bunny's documented rule), publish-after-conversion, attachments (access, validation, versions), email delivery through a real SMTP server (login details, reminders, de-duplication, quiet hours, bad credentials), tamper-resistant progress, the learner journey, attempt limits, versioning, outlet/brand scoping, CSV and audit.

## Configuration

See [.env.example](.env.example). Production needs `JWT_SECRET`; `STORAGE_DRIVER=s3` + `S3_BUCKET` for PDFs/images; `DATABASE_SSL=true` for RDS; the `BUNNY_*` values for video and `SMTP_*` + `MAIL_FROM` for email.
