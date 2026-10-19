// Demo data for local development. Refuses to run against a database that already has users.
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { assignTrainingPath } from '../src/assign.js';

const PASSWORD = 'Demo@1234';

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to create demo users with a well-known password in production. Use `npm run create-admin` instead.');
  process.exit(1);
}

await migrate(() => {});
if ((await db.one('SELECT count(*)::int AS n FROM users')).n > 0) {
  console.error('Database already has users - not seeding.');
  await db.close();
  process.exit(1);
}

const hash = await bcrypt.hash(PASSWORD, 10);
const q = (text, params) => db.one(text, params);

const burger = await q(`INSERT INTO brands (name) VALUES ('Burger Barn') RETURNING id`);
const dosa = await q(`INSERT INTO brands (name) VALUES ('Dosa Delight') RETURNING id`);
const andheri = await q(`INSERT INTO outlets (name, brand_id) VALUES ('Andheri', $1) RETURNING id`, [burger.id]);
const bandra = await q(`INSERT INTO outlets (name, brand_id) VALUES ('Bandra', $1) RETURNING id`, [burger.id]);
const powai = await q(`INSERT INTO outlets (name, brand_id) VALUES ('Powai', $1) RETURNING id`, [dosa.id]);

const user = (employeeId, name, role, extra = {}) =>
  q(
    `INSERT INTO users (employee_id, name, role, brand_id, outlet_id, designation, shift_start, shift_end, password_hash, must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false) RETURNING id`,
    [employeeId, name, role, extra.brand ?? null, extra.outlet ?? null, extra.designation ?? null, extra.shiftStart ?? null, extra.shiftEnd ?? null, hash],
  );

const admin = await user('ADMIN001', 'Asha Admin', 'super_admin');
await user('TRAIN001', 'Tara Trainer', 'training_admin');
const franchisee = await user('FR001', 'Farhan Franchisee', 'franchisee', { brand: burger.id });
await db.query('UPDATE outlets SET franchisee_id = $1 WHERE id = $2', [franchisee.id, bandra.id]);
await user('INC001', 'Isha In-charge', 'outlet_incharge', { brand: burger.id, outlet: andheri.id, designation: 'Outlet In-charge' });
await user('INC002', 'Imran In-charge', 'outlet_incharge', { brand: burger.id, outlet: bandra.id, designation: 'Outlet In-charge' });
await user('TM001', 'Tina Team (09:00-18:00 shift)', 'team_member', { brand: burger.id, outlet: andheri.id, designation: 'Crew', shiftStart: '09:00', shiftEnd: '18:00' });
await user('TM002', 'Tarun Team (no shift limit)', 'team_member', { brand: burger.id, outlet: andheri.id, designation: 'Crew' });
await user('TM003', 'Tanvi Team', 'team_member', { brand: burger.id, outlet: bandra.id, designation: 'Crew' });
await user('TM004', 'Tejas Team', 'team_member', { brand: dosa.id, outlet: powai.id, designation: 'Crew' });

const mcq = (text, options, type = 'single') => ({ type, text, options: options.map(([t, correct], i) => ({ id: String.fromCharCode(97 + i), text: t, correct })) });
async function module(m, questions = []) {
  const row = await q(
    `INSERT INTO modules (title, description, category, instructions, brand_id, roles, sequence, prerequisite_id, pass_mark, status, created_by, min_watch_percent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10,90) RETURNING *`,
    [m.title, m.description, m.category, m.instructions, m.brand ?? null, m.roles, m.sequence, m.prerequisite ?? null, m.passMark ?? 70, admin.id],
  );
  for (const [i, qu] of questions.entries()) {
    await db.query('INSERT INTO questions (module_id, position, type, text, options) VALUES ($1,$2,$3,$4,$5)', [row.id, i, qu.type, qu.text, JSON.stringify(qu.options ?? [])]);
  }
  await db.query(
    `INSERT INTO module_versions (module_id, version, change_type, note, snapshot, created_by) VALUES ($1,1,'initial','Seed data',$2,$3)`,
    [row.id, JSON.stringify({ module: row, questions }), admin.id],
  );
  return row;
}

const safety = await module(
  {
    title: 'Food Safety Basics',
    description: 'Hygiene, temperature control and cross-contamination.',
    category: 'Food safety',
    instructions: 'Wash hands for 20 seconds before handling food.\n\nKeep cold food at or below 5°C and hot food at or above 60°C.\n\nUse separate boards and knives for raw and cooked food.',
    roles: ['team_member', 'outlet_incharge'],
    sequence: 1,
  },
  [
    mcq('How long should you wash your hands before handling food?', [['5 seconds', false], ['20 seconds', true], ['1 minute', false]]),
    mcq('Which temperatures are safe? (select all)', [['Cold food at 4°C', true], ['Hot food at 65°C', true], ['Hot food at 40°C', false]], 'multiple'),
    mcq('Raw chicken and salad can share a chopping board.', [['True', false], ['False', true]]),
    { type: 'written', text: 'Describe one hygiene mistake you have seen in a kitchen (optional).' },
  ],
);
await module(
  {
    title: 'Burger Assembly SOP',
    description: 'Standard build order and portioning for Burger Barn.',
    category: 'Operations',
    instructions: 'Toast the bun for 20 seconds.\n\nBuild order: sauce, patty, cheese, lettuce, tomato, top bun.\n\nSend only burgers that match the plating photo.',
    brand: burger.id,
    roles: ['team_member'],
    sequence: 2,
    prerequisite: safety.id,
  },
  [mcq('What goes on the bun first?', [['Lettuce', false], ['Sauce', true], ['Tomato', false]])],
);
await module(
  { title: 'Shift Handover for In-charges', description: 'Opening, closing and handover checks.', category: 'Leadership', instructions: 'Complete the handover checklist with the incoming in-charge.', roles: ['outlet_incharge'], sequence: 3 },
  [mcq('Who signs the handover checklist?', [['Only the outgoing in-charge', false], ['Both in-charges', true]])],
);
await module(
  { title: 'Franchisee Operations 101', description: 'Brand standards, audits and reporting for franchise partners.', category: 'Franchise', instructions: 'Review the brand standards manual and audit calendar.', roles: ['franchisee'], sequence: 4 },
  [mcq('How often are outlet audits held?', [['Monthly', true], ['Never', false]])],
);

await db.query(
  `INSERT INTO recipes (name, brand_id, category, roles, status, portion_size, yield, equipment, ingredients, steps, cooking_instructions, storage, shelf_life, food_safety, common_mistakes, quality_checkpoints, updated_by)
   VALUES ('Classic Cheeseburger', $1, 'Burgers', '{team_member,outlet_incharge,franchisee}', 'published', '1 burger (220 g)', '1 portion', 'Flat-top grill, bun toaster',
           $2, $3, 'Grill patty 3 minutes per side until the core reaches 74°C.', 'Keep raw patties at 0–4°C.', 'Raw patties: 2 days. Cooked: serve immediately.',
           'Core temperature must reach 74°C. Wash hands after handling raw patties.', 'Overcooking the patty; adding sauce after the lettuce.', 'Bun toasted golden; cheese fully melted; matches plating photo.', $4)`,
  [
    burger.id,
    JSON.stringify([{ name: 'Beef patty', quantity: '120', unit: 'g' }, { name: 'Burger bun', quantity: '1', unit: 'pc' }, { name: 'Cheese slice', quantity: '1', unit: 'pc' }, { name: 'House sauce', quantity: '15', unit: 'g' }]),
    JSON.stringify(['Toast the bun.', 'Grill the patty 3 minutes per side.', 'Add cheese for the last 30 seconds.', 'Assemble: sauce, patty, cheese, lettuce, tomato.']),
    admin.id,
  ],
);
await db.query(
  `INSERT INTO recipes (name, brand_id, category, roles, status, portion_size, yield, ingredients, steps, updated_by)
   VALUES ('Masala Dosa Batter', $1, 'Batters', '{team_member,outlet_incharge,franchisee}', 'published', '150 ml per dosa', '40 dosas', $2, $3, $4)`,
  [dosa.id, JSON.stringify([{ name: 'Rice', quantity: '3', unit: 'kg' }, { name: 'Urad dal', quantity: '1', unit: 'kg' }]), JSON.stringify(['Soak rice and dal separately for 6 hours.', 'Grind and ferment for 8–10 hours.']), admin.id],
);

for (const row of await db.all(`SELECT id FROM users WHERE role IN ('team_member','outlet_incharge','franchisee')`)) {
  await assignTrainingPath(db.query, row.id, admin.id);
}

console.log(`Seeded demo data. Every demo user has the password: ${PASSWORD}\n`);
console.log('  ADMIN001  super admin          TRAIN001  training admin');
console.log('  INC001    in-charge Andheri    INC002    in-charge Bandra');
console.log('  FR001     franchisee (owns Bandra)');
console.log('  TM001     team member Andheri, shift 09:00-18:00 (content locks outside it)');
console.log('  TM002-4   team members without a shift limit');
await db.close();
