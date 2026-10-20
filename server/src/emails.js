import { config } from './config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: config.timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

function layout({ heading, paragraphs = [], list = [], button }) {
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:16px;color:#1d1b1a">
  <h2 style="color:#b4231f;margin:0 0 12px">${esc(heading)}</h2>
  ${paragraphs.map((p) => `<p style="line-height:1.5">${p.html ?? esc(p)}</p>`).join('')}
  ${list.length ? `<ul style="line-height:1.6">${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
  ${button ? `<p><a href="${esc(button.url)}" style="background:#b4231f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(button.label)}</a></p>` : ''}
  <p style="color:#6b6560;font-size:12px;margin-top:24px">Staff Training · Indoventura Foodteck</p></div>`;
  const text = [heading, '', ...paragraphs.map((p) => p.text ?? p), ...(list.length ? ['', ...list.map((l) => `- ${l}`)] : []), ...(button ? ['', `${button.label}: ${button.url}`] : [])].join('\n');
  return { html, text };
}

const link = { label: 'Open Staff Training', url: config.appUrl };

export function inviteEmail({ name, employeeId, password }) {
  return {
    subject: 'Your Staff Training login',
    ...layout({
      heading: `Welcome, ${name}`,
      paragraphs: [
        'Your Staff Training account is ready. Sign in with:',
        { html: `Employee ID: <b>${esc(employeeId)}</b><br>Temporary password: <b>${esc(password)}</b>`, text: `Employee ID: ${employeeId}\nTemporary password: ${password}` },
        'You will be asked to choose your own password the first time you sign in.',
      ],
      button: link,
    }),
  };
}

export function passwordResetEmail({ name, employeeId, password }) {
  return {
    subject: 'Your Staff Training password was reset',
    ...layout({
      heading: `Hi ${name}`,
      paragraphs: [
        'An administrator reset your password. Sign in with:',
        { html: `Employee ID: <b>${esc(employeeId)}</b><br>Temporary password: <b>${esc(password)}</b>`, text: `Employee ID: ${employeeId}\nTemporary password: ${password}` },
        'You will be asked to choose a new password. If you did not expect this, tell your manager.',
      ],
      button: link,
    }),
  };
}

const COPY = {
  new_training: { subject: (n) => `New training assigned (${n})`, intro: 'You have new training to complete:' },
  due_soon: { subject: (n) => `Training due soon (${n})`, intro: 'These modules are due soon:' },
  overdue: { subject: (n) => `Overdue training (${n})`, intro: 'These modules are overdue. Please complete them as soon as you can:' },
  retraining: { subject: (n) => `Retraining required (${n})`, intro: 'These modules were updated and you need to complete them again:' },
};

/** One email per person per kind, listing every module involved. items: [{ title, dueAt }] */
export function trainingEmail({ name, kind, items }) {
  const c = COPY[kind];
  return {
    subject: c.subject(items.length),
    ...layout({
      heading: `Hi ${name}`,
      paragraphs: [c.intro],
      list: items.map((i) => (i.dueAt ? `${i.title} — due ${day(i.dueAt)}` : i.title)),
      button: link,
    }),
  };
}

export const testEmail = () => ({
  subject: 'Staff Training test email',
  ...layout({ heading: 'Email is working', paragraphs: ['This is a test message from Staff Training. Reminders and login details will be sent from this address.'] }),
});
