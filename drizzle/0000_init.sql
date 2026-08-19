CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  voter_token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX votes_poll_voter_idx ON votes (poll_id, voter_token);
CREATE INDEX options_poll_idx ON options (poll_id);
CREATE INDEX votes_poll_idx ON votes (poll_id);
