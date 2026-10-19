import { db } from '../src/db.js';
import { migrate } from '../src/migrate.js';

await migrate();
await db.close();
console.log('migrations up to date');
