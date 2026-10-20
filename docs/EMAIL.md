# Email with Brevo (SMTP)

The app sends email through **Brevo's SMTP relay**: login details for new users, password-reset details, and training reminders. Email is **off until you add the credentials**; nothing breaks without them.

## 1. Set it up in Brevo

1. Create a Brevo account and **add your sender**: Senders, domains & dedicated IPs → add and verify the address (e.g. `training@yourcompany.com`). Authenticate your domain (DKIM / SPF / DMARC) so messages land in the inbox, not spam.
2. Open **SMTP & API → SMTP** and generate an **SMTP key**. You need two things from this page:
   * the **SMTP login** (shown on the page) → `SMTP_USER`
   * the **SMTP key** → `SMTP_PASS` — *not* an API key
3. Add the settings to the server:

```
SMTP_USER=<your Brevo SMTP login>
SMTP_PASS=<your Brevo SMTP key>
MAIL_FROM="Staff Training <training@yourcompany.com>"     # must be a verified sender
APP_URL=https://training.yourcompany.com                   # used for the links in emails
# SMTP_HOST=smtp-relay.brevo.com   (default)
# SMTP_PORT=587                    (default, STARTTLS). For SSL use SMTP_PORT=465
```
Restart the server after changing them.

## 2. Check it

Open **Email** in the app (Super Admin), type your address and press **Send test**. A wrong login, key or sender shows Brevo's reason on screen and in the log below it.

## 3. What gets sent

| Email | When | To |
|---|---|---|
| **Login details** | When you add a user *and tick "Email the Employee ID and temporary password"* | the new user |
| **Password reset** | When you reset a password *and tick "Email it"* | that user |
| **New training** | Within ~30 minutes of training being assigned (or a new joiner's path) | the learner |
| **Due soon** | 3 days before the deadline | the learner |
| **Overdue** | The day it becomes overdue, then every 3 days (at most 5 times) | the learner |
| **Retraining required** | When a new version needs retraining | the learner |

* One email per person per kind, listing every module involved (no flood).
* Only staff with an **email address** are emailed (add it on the Users page). Everyone else simply sees the same information on their dashboard.
* Reminders go out **08:00–20:00 India time**, checked every 30 minutes by the app itself. Each reminder is sent once, even with several app instances running, and a restart never repeats one. If a send fails it is logged and *not* retried within the same reminder window (the next window, e.g. the next overdue step, tries again). **Email → Send due reminders now** runs the job on demand.
* Completed training is never chased. Emails contain module titles and due dates, nothing else about assessments or scores.

Tuning (optional): `REMINDERS_ENABLED=false`, `REMINDER_START_HOUR`, `REMINDER_END_HOUR`, `REMINDER_DUE_SOON_DAYS`, `REMINDER_INTERVAL_MINUTES`.

## 4. Good to know

* **Passwords by email:** the temporary password is single-use in effect (the person must choose their own at first sign-in), but it still travels by email. If you'd rather not, leave the box unticked and hand it over in person; the app shows it to you once either way.
* Brevo has a **daily sending limit that depends on your plan**: check it against your headcount, especially for the first reminder run.
* Every email attempt (sent or failed) is listed under **Email → Recent emails**.
