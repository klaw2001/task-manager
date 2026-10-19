import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { client, setup } from './helpers.js';

let ctx;
before(async () => { ctx = await setup({ seed: false }); });
after(async () => { await ctx.close(); });

test('first boot: creates the super admin from ADMIN_* only while the database has no users', async () => {
  const { bootstrapAdmin } = await import('../src/bootstrap.js');
  await bootstrapAdmin({}, () => {});
  assert.equal((await ctx.db.one('SELECT count(*)::int AS n FROM users')).n, 0, 'no ADMIN_* variables: nothing happens');

  const env = { ADMIN_EMPLOYEE_ID: 'BOOT001', ADMIN_PASSWORD: 'Bootstrap-1', ADMIN_NAME: 'Boot Admin' };
  await bootstrapAdmin(env, () => {});
  const admin = await ctx.db.one(`SELECT role, must_change_password FROM users WHERE employee_id = 'BOOT001'`);
  assert.deepEqual(admin, { role: 'super_admin', must_change_password: true });

  await bootstrapAdmin({ ...env, ADMIN_EMPLOYEE_ID: 'BOOT002' }, () => {});
  assert.equal(await ctx.db.one(`SELECT 1 FROM users WHERE employee_id = 'BOOT002'`), null, 'users exist now: leftover env vars are ignored');

  const c = client(ctx.baseUrl);
  assert.equal((await c.post('/api/auth/login', { employeeId: 'BOOT001', password: 'Bootstrap-1' })).status, 200);
  assert.equal((await c.get('/api/admin/users')).error.code, 'PASSWORD_CHANGE_REQUIRED', 'must choose a new password before doing anything');
  assert.equal((await c.post('/api/auth/change-password', { currentPassword: 'Bootstrap-1', newPassword: 'My-new-pass-9' })).status, 200);
  assert.equal((await c.get('/api/admin/users')).status, 200);
});

test('health check works against the database', async () => {
  const res = await fetch(`${ctx.baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
