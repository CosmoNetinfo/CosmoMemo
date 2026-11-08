CREATE TABLE IF NOT EXISTS cm_owner (
  id integer PRIMARY KEY CHECK (id = 1),
  password_hash text NOT NULL,
  session_version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cm_workspace (
  id integer PRIMARY KEY CHECK (id = 1),
  revision integer NOT NULL DEFAULT 0,
  document jsonb NOT NULL,
  updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS cm_memories (
  key text PRIMARY KEY,
  content text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]',
  revision integer NOT NULL DEFAULT 1,
  updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS cm_clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  redirect_uris jsonb NOT NULL,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS cm_codes (
  hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES cm_clients(id),
  redirect_uri text NOT NULL,
  challenge text NOT NULL,
  resource text NOT NULL,
  scope text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS cm_grants (
  id text PRIMARY KEY,
  family text NOT NULL,
  client_id text NOT NULL REFERENCES cm_clients(id),
  access_hash text NOT NULL UNIQUE,
  refresh_hash text NOT NULL UNIQUE,
  resource text NOT NULL,
  scope text NOT NULL,
  expires_at bigint NOT NULL,
  refresh_expires_at bigint NOT NULL,
  created_at bigint NOT NULL,
  revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS cm_grants_family ON cm_grants(family);
CREATE TABLE IF NOT EXISTS cm_rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at bigint NOT NULL
);
REVOKE ALL ON cm_owner, cm_workspace, cm_memories, cm_clients, cm_codes, cm_grants, cm_rate_limits FROM PUBLIC;
