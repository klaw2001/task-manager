CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- franchisee_id gets its foreign key once users exists
CREATE TABLE outlets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand_id INT NOT NULL REFERENCES brands(id),
  franchisee_id INT,
  UNIQUE (brand_id, name)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mobile TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin','training_admin','outlet_incharge','team_member','franchisee')),
  brand_id INT REFERENCES brands(id),
  outlet_id INT REFERENCES outlets(id),
  designation TEXT,
  manager_id INT REFERENCES users(id) ON DELETE SET NULL,
  joining_date DATE,
  language TEXT NOT NULL DEFAULT 'en',
  -- content is only available between these times (outlet timezone). NULL = no restriction.
  shift_start TIME,
  shift_end TIME,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_outlet_idx ON users(outlet_id);

ALTER TABLE outlets ADD CONSTRAINT outlets_franchisee_fk
  FOREIGN KEY (franchisee_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE modules (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  language TEXT NOT NULL DEFAULT 'en',
  video_key TEXT,
  duration_seconds INT,
  instructions TEXT NOT NULL DEFAULT '',
  brand_id INT REFERENCES brands(id),                 -- NULL = all brands
  roles TEXT[] NOT NULL DEFAULT '{team_member}',
  mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  sequence INT NOT NULL DEFAULT 0,
  prerequisite_id INT REFERENCES modules(id) ON DELETE SET NULL,
  default_due_days INT NOT NULL DEFAULT 14,
  min_watch_percent INT NOT NULL DEFAULT 90 CHECK (min_watch_percent BETWEEN 0 AND 100),
  pass_mark INT NOT NULL DEFAULT 70 CHECK (pass_mark BETWEEN 0 AND 100),
  max_attempts INT NOT NULL DEFAULT 3 CHECK (max_attempts >= 0),   -- 0 = unlimited
  randomize BOOLEAN NOT NULL DEFAULT TRUE,
  requires_ack BOOLEAN NOT NULL DEFAULT TRUE,
  ack_text TEXT NOT NULL DEFAULT 'I have read and understood this SOP and will follow it.',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INT NOT NULL DEFAULT 1,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one snapshot per version, taken when the version is created
CREATE TABLE module_versions (
  id SERIAL PRIMARY KEY,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  version INT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('initial','retrain','reack')),
  note TEXT,
  snapshot JSONB NOT NULL,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, version)
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('single','multiple','written')),
  text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'                 -- [{id, text, correct}]
);
CREATE INDEX questions_module_idx ON questions(module_id);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  assigned_by INT REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  UNIQUE (user_id, module_id)
);

-- one row per user, module AND version: history of earlier versions is kept
CREATE TABLE progress (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  version INT NOT NULL,
  last_position REAL NOT NULL DEFAULT 0,
  watched_seconds REAL NOT NULL DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  lesson_completed_at TIMESTAMPTZ,
  assessment_passed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id, version)
);

CREATE TABLE attempts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  version INT NOT NULL,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attempts_lookup_idx ON attempts(user_id, module_id, version);

CREATE TABLE recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand_id INT REFERENCES brands(id),                 -- NULL = all brands
  category TEXT NOT NULL DEFAULT 'General',
  roles TEXT[] NOT NULL DEFAULT '{team_member,outlet_incharge,franchisee}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  video_key TEXT,
  image_key TEXT,
  portion_size TEXT NOT NULL DEFAULT '',
  yield TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  ingredients JSONB NOT NULL DEFAULT '[]',            -- [{name, quantity, unit}]
  steps JSONB NOT NULL DEFAULT '[]',                  -- [text]
  cooking_instructions TEXT NOT NULL DEFAULT '',
  storage TEXT NOT NULL DEFAULT '',
  shelf_life TEXT NOT NULL DEFAULT '',
  food_safety TEXT NOT NULL DEFAULT '',
  common_mistakes TEXT NOT NULL DEFAULT '',
  quality_checkpoints TEXT NOT NULL DEFAULT '',
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log(created_at DESC);
