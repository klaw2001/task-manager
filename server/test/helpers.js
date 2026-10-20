import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeBunny, startFakeSmtp } from './fakes.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Fresh seeded database + running app. Needs TEST_DATABASE_URL pointing at a database whose name ends in _test. */
export async function setup({ seed = true } = {}) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/_test(\?|$)/.test(url)) throw new Error('Set TEST_DATABASE_URL to a throwaway database whose name ends in _test (it is wiped on every run)');
  process.env.DATABASE_URL = url;
  process.env.LOGIN_FAILURES_PER_ACCOUNT = '3';
  process.env.LOCAL_STORAGE_DIR = path.join(root, '.test-uploads');

  // stand-ins for Bunny Stream and Brevo, so the real flows run without credentials
  const bunny = await startFakeBunny();
  const smtp = await startFakeSmtp();
  Object.assign(process.env, {
    BUNNY_STREAM_LIBRARY_ID: bunny.libraryId, BUNNY_STREAM_API_KEY: bunny.apiKey, BUNNY_TOKEN_KEY: bunny.tokenKey,
    BUNNY_CDN_HOSTNAME: bunny.url, BUNNY_API_BASE: bunny.url, BUNNY_TUS_ENDPOINT: `${bunny.url}/tusupload`, BUNNY_TOKEN_TTL_SECONDS: '600',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: smtp.user, SMTP_PASS: smtp.pass, SMTP_REQUIRE_TLS: 'false',
    MAIL_FROM: 'Staff Training <training@example.test>', APP_URL: 'https://training.example.test',
  });

  const { db } = await import('../src/db.js');
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  if (seed) execFileSync('node', ['scripts/seed.js'], { cwd: root, env: process.env, stdio: 'pipe' });
  else await (await import('../src/migrate.js')).migrate(() => {});

  const { createApp } = await import('../src/app.js');
  const server = await new Promise((ok) => { const s = createApp().listen(0, () => ok(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { db, baseUrl, bunny, smtp, close: async () => { server.close(); await db.close(); await bunny.close(); await smtp.close(); } };
}

export function client(baseUrl) {
  let cookie = '';
  async function call(method, url, body, headers = {}) {
    const isRaw = body instanceof Uint8Array;
    const res = await fetch(baseUrl + url, {
      method,
      headers: { ...(body && !isRaw ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? (isRaw ? body : JSON.stringify(body)) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      cookie = value ? `${name}=${value}` : '';
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers, error: data?.error };
  }
  return {
    get: (u, h) => call('GET', u, undefined, h),
    post: (u, b) => call('POST', u, b ?? {}),
    put: (u, b, h) => call('PUT', u, b, h),
    patch: (u, b) => call('PATCH', u, b),
    delete: (u) => call('DELETE', u),
    async login(employeeId, password = 'Demo@1234') {
      const r = await call('POST', '/api/auth/login', { employeeId, password });
      if (r.status !== 200) throw new Error(`login ${employeeId} failed: ${r.status} ${JSON.stringify(r.data)}`);
      return r;
    },
  };
}

/** HH:MM strings for a window relative to now, in the app timezone. */
export function windowAround(offsetStartHours, offsetEndHours, timeZone = 'Asia/Kolkata') {
  const now = new Date();
  const fmt = (h) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now.getTime() + h * 3600_000));
  return { start: fmt(offsetStartHours), end: fmt(offsetEndHours) };
}
