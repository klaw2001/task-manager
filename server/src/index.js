import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import { bootstrapAdmin } from './bootstrap.js';
import { migrate } from './migrate.js';
import { startReminderScheduler } from './reminders.js';

if (process.env.AUTO_MIGRATE !== 'false') await migrate();
await bootstrapAdmin();

if (startReminderScheduler()) console.log('Email reminders are on');

const server = createApp().listen(config.port, () => console.log(`LMS listening on :${config.port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => db.close().then(() => process.exit(0))));
}
