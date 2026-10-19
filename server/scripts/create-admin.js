// Creates a Super Admin. Usage:
//   ADMIN_EMPLOYEE_ID=ADMIN001 ADMIN_NAME="Head Office" ADMIN_PASSWORD='...' npm run create-admin
// If ADMIN_PASSWORD is omitted a random one is generated and printed once.
import { randomBytes } from 'node:crypto';
import { db } from '../src/db.js';
import { createAdmin } from '../src/bootstrap.js';
import { migrate } from '../src/migrate.js';

await migrate(() => {});
const employeeId = process.env.ADMIN_EMPLOYEE_ID || 'ADMIN001';
const password = process.env.ADMIN_PASSWORD || `${randomBytes(6).toString('base64url')}7`;

if (await createAdmin({ employeeId, name: process.env.ADMIN_NAME || 'Super Admin', password })) {
  console.log(`Created super admin ${employeeId}\nTemporary password: ${password}\n(you will be asked to change it at first sign-in)`);
} else {
  console.error(`User ${employeeId} already exists`);
  process.exitCode = 1;
}
await db.close();
