-- ============================================================
-- FORGE ATLAS · swarm ledger schema (D1)
-- The shared, persistent world state every visitor sees.
-- Apply:  npx wrangler d1 execute forge-atlas-ledger --remote --file=db/schema.sql
-- ============================================================

-- One row per completed swarm match.
CREATE TABLE IF NOT EXISTS matches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,                              -- unix ms, set server-side
  winner       TEXT    NOT NULL CHECK (winner IN ('sigma','omega','draw')),
  sigma_score  INTEGER NOT NULL DEFAULT 0,
  omega_score  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_matches_ts ON matches (ts);

-- One row per spectator prompt injected into a match.
CREATE TABLE IF NOT EXISTS prompts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,                                  -- unix ms, set server-side
  faction  TEXT    NOT NULL CHECK (faction IN ('sigma','omega'))
);
CREATE INDEX IF NOT EXISTS idx_prompts_ts ON prompts (ts);
