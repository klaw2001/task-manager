import bcrypt from 'bcryptjs';
import { db } from './db.js';

/** Creates a Super Admin who must change the password at first sign-in. Returns false if the ID already exists. */
export async function createAdmin({ employeeId, name = 'Super Admin', password }) {
  const hash = await bcrypt.hash(password, 10);
  const row = await db.one(
    `INSERT INTO users (employee_id, name, role, password_hash, must_change_password)
     VALUES ($1, $2, 'super_admin', $3, true) ON CONFLICT (employee_id) DO NOTHING RETURNING id`,
    [employeeId, name, hash],
  );
  return Boolean(row);
}

/**
 * First deployment on a platform without a shell (e.g. AWS App Runner): if the database has no users and
 * ADMIN_EMPLOYEE_ID + ADMIN_PASSWORD are set, create the first Super Admin. Remove those variables afterwards.
 */
export async function bootstrapAdmin(env = process.env, log = console.log) {
  if (!env.ADMIN_EMPLOYEE_ID || !env.ADMIN_PASSWORD) return;
  const { n } = await db.one('SELECT count(*)::int AS n FROM users');
  if (n > 0) return;
  await createAdmin({ employeeId: env.ADMIN_EMPLOYEE_ID, name: env.ADMIN_NAME || 'Super Admin', password: env.ADMIN_PASSWORD });
  log(`Created first super admin ${env.ADMIN_EMPLOYEE_ID}. Sign in, change the password, then remove ADMIN_* from the environment.`);
}
