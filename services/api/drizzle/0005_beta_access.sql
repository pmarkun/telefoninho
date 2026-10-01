ALTER TABLE parent_user ADD COLUMN auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE parent_user ADD COLUMN email_verified_at integer;
ALTER TABLE parent_user ADD COLUMN policy_version text;
ALTER TABLE family_member ADD COLUMN token_version integer NOT NULL DEFAULT 0;
ALTER TABLE pairing_code ADD COLUMN revoked_at integer;
ALTER TABLE asterisk_config_state ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE access_link (
  id text PRIMARY KEY NOT NULL, token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL, email text NOT NULL, family_id text REFERENCES family(id),
  created_by text REFERENCES parent_user(id), expires_at integer NOT NULL,
  used_at integer, revoked_at integer, created_at integer NOT NULL
);
CREATE TABLE email_outbox (
  id text PRIMARY KEY NOT NULL, link_id text NOT NULL REFERENCES access_link(id),
  encrypted_payload text NOT NULL, attempts integer NOT NULL DEFAULT 0,
  next_attempt_at integer NOT NULL, sent_at integer, last_error text
);
CREATE TABLE family_setup (
  family_id text PRIMARY KEY NOT NULL REFERENCES family(id),
  child_id text NOT NULL REFERENCES family_member(id), adult_id text NOT NULL REFERENCES family_member(id),
  first_call_confirmed_at integer
);
CREATE TABLE member_device (
  member_id text PRIMARY KEY NOT NULL REFERENCES family_member(id),
  device_id text NOT NULL, device_name text NOT NULL, paired_at integer NOT NULL
);
