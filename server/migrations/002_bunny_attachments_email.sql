-- Contact email (optional: kitchen staff may not have one)
ALTER TABLE users ADD COLUMN email TEXT;

-- Videos now live on Bunny Stream. These columns used to hold object-storage keys and now hold the
-- Bunny video GUID; nothing had been deployed with the old meaning, so any old values are cleared.
ALTER TABLE modules RENAME COLUMN video_key TO video_id;
ALTER TABLE recipes RENAME COLUMN video_key TO video_id;
UPDATE modules SET video_id = NULL;
UPDATE recipes SET video_id = NULL;

-- PDF, image and video attachments on a module or a recipe
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  module_id INT REFERENCES modules(id) ON DELETE CASCADE,
  recipe_id INT REFERENCES recipes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pdf','image','video')),
  title TEXT NOT NULL,
  file_key TEXT,          -- pdf / image: object-storage key (S3)
  video_id TEXT,          -- video: Bunny Stream video GUID
  content_type TEXT,
  size_bytes BIGINT,
  position INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((module_id IS NULL) <> (recipe_id IS NULL)),
  CHECK ((kind = 'video' AND video_id IS NOT NULL AND file_key IS NULL)
      OR (kind <> 'video' AND file_key IS NOT NULL AND video_id IS NULL))
);
CREATE INDEX attachments_module_idx ON attachments(module_id);
CREATE INDEX attachments_recipe_idx ON attachments(recipe_id);

-- Every email the app sends (or tried to). dedupe_keys makes reminders idempotent across restarts / instances.
CREATE TABLE email_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  to_address TEXT NOT NULL,
  kind TEXT NOT NULL,     -- invite | password_reset | new_training | due_soon | overdue | retraining | test
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX email_log_created_idx ON email_log(created_at DESC);

CREATE TABLE reminder_items (
  dedupe_key TEXT PRIMARY KEY,
  email_id BIGINT NOT NULL REFERENCES email_log(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
