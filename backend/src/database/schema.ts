export const schema = `
  CREATE TABLE IF NOT EXISTS elders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    languages TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(languages)),
    consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0, 1)),
    consent_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS walks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elder_id INTEGER NOT NULL REFERENCES elders(id),
    walk_date TEXT NOT NULL,
    place_label TEXT NOT NULL,
    duration_minutes INTEGER CHECK (duration_minutes >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (id, elder_id)
  );

  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elder_id INTEGER NOT NULL REFERENCES elders(id),
    walk_id INTEGER,
    local_name TEXT NOT NULL CHECK (length(trim(local_name)) > 0),
    other_names TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(other_names)),
    appearance TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(appearance)),
    habitat TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(habitat)),
    uses TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(uses)),
    preparation TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(preparation)),
    warnings TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings)),
    story TEXT NOT NULL DEFAULT '',
    raw_notes TEXT NOT NULL DEFAULT '',
    photo_path TEXT,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shareable')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (walk_id, elder_id) REFERENCES walks(id, elder_id)
  );

  CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    question TEXT NOT NULL CHECK (length(trim(question)) > 0),
    answered INTEGER NOT NULL DEFAULT 0 CHECK (answered IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS walks_elder_idx ON walks(elder_id);
  CREATE INDEX IF NOT EXISTS plants_elder_idx ON plants(elder_id);
  CREATE INDEX IF NOT EXISTS plants_walk_idx ON plants(walk_id);
  CREATE INDEX IF NOT EXISTS plants_visibility_idx ON plants(visibility);
  CREATE INDEX IF NOT EXISTS followups_plant_idx ON followups(plant_id);
`;
