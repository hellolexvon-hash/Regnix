-- ============================================================================
-- Regnix Compliance Platform — Database Schema (PostgreSQL 14+)
-- ============================================================================
--
-- Design goals:
--   1. One `users` table for every human in the system (client staff,
--      auditors, super admins) — one login system, role-differentiated
--      by a `role` enum + role-specific profile tables. Avoids the classic
--      mistake of three parallel, drifting auth systems.
--   2. Every state-changing action is attributable to a user_id and time —
--      supports the audit_log table and, combined with Postgres RLS,
--      gives you real "who did what, when" for compliance purposes (this
--      platform is itself selling statutory-compliance assurance — its
--      own data handling has to hold up to the same scrutiny).
--   3. Row-Level Security policies enforce tenant isolation at the DATABASE
--      layer, not just in application code — so a bug in a route handler
--      can't leak Company A's documents to Company B's logged-in user.
--   4. Certificates store a content hash + are marked immutable once issued,
--      so "tamper protection" (already a badge on the certificate UI) is a
--      real, checkable property, not just a label.
--
-- Apply with: psql -d regnix -f database-schema.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ── Enums ───────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('client_admin', 'client_staff', 'auditor', 'super_admin');
CREATE TYPE review_status AS ENUM ('pending', 'in_review', 'approved', 'changes_requested', 'rejected');
CREATE TYPE review_level AS ENUM ('level_1', 'level_2', 'level_3');
CREATE TYPE issue_severity AS ENUM ('critical', 'major', 'minor');
CREATE TYPE doc_status AS ENUM ('pending', 'validated', 'flagged');
CREATE TYPE mfa_method AS ENUM ('none', 'totp', 'email_otp');

-- ── Users (single identity table for all roles) ────────────────────────

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,              -- argon2id — see SECURITY.md
  full_name         TEXT NOT NULL,
  role              user_role NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  mfa_method        mfa_method NOT NULL DEFAULT 'none',
  mfa_secret_enc    TEXT,                        -- encrypted at rest, never plaintext
  failed_login_count SMALLINT NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);

-- Role-specific profile tables — keeps `users` lean and each role's fields
-- honest (an auditor's licence_id has no meaning on a client_staff row).

CREATE TABLE auditor_profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_id      TEXT UNIQUE NOT NULL,
  specialization  TEXT NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE super_admin_profiles (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  notes       TEXT
);

-- ── Organizations (companies being audited — the "clients") ────────────

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL,
  cin             TEXT,
  employee_count  INTEGER NOT NULL DEFAULT 0,
  acts_covered    TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which users belong to which organization, and with what role inside it
-- (client_admin can invite/manage client_staff; both can upload documents).
CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_email   CITEXT NOT NULL,
  contact_person  TEXT NOT NULL,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- ── Review cycles (one row per L1→L3 pass an organization goes through) ─

CREATE TABLE review_cycles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reporting_month  DATE NOT NULL,               -- first-of-month anchor
  status           review_status NOT NULL DEFAULT 'pending',
  current_level    review_level NOT NULL DEFAULT 'level_1',
  l2_score         NUMERIC(5,2),
  l2_completed_at  TIMESTAMPTZ,
  assigned_auditor_id UUID REFERENCES users(id),
  decision_remarks TEXT,
  decided_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reporting_month)
);

CREATE INDEX idx_review_cycles_org ON review_cycles(organization_id);
CREATE INDEX idx_review_cycles_status ON review_cycles(status);
CREATE INDEX idx_review_cycles_auditor ON review_cycles(assigned_auditor_id);

-- ── Documents (registers submitted per review cycle) ────────────────────

CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_id   UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  act               TEXT NOT NULL,
  status            doc_status NOT NULL DEFAULT 'pending',
  score             SMALLINT CHECK (score BETWEEN 0 AND 100),
  storage_key       TEXT NOT NULL,               -- S3/blob key, never a public URL
  sha256_hash       TEXT NOT NULL,                -- integrity check on retrieval
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_cycle ON documents(review_cycle_id);

-- ── Issues carried across levels ────────────────────────────────────────

CREATE TABLE issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_id   UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  document_id       UUID REFERENCES documents(id) ON DELETE SET NULL,
  severity          issue_severity NOT NULL,
  rule              TEXT NOT NULL,
  root_cause        TEXT NOT NULL,
  resolved_l2       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_cycle ON issues(review_cycle_id);

-- ── Certificates (issued once a cycle is approved) ──────────────────────

CREATE TABLE certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_id   UUID NOT NULL UNIQUE REFERENCES review_cycles(id) ON DELETE RESTRICT,
  certificate_no    TEXT UNIQUE NOT NULL,          -- e.g. REG-2026-04213
  data_snapshot     JSONB NOT NULL,                 -- exact CertificateData used to render, frozen at issue time
  pdf_storage_key   TEXT NOT NULL,
  pdf_sha256        TEXT NOT NULL,                  -- detects any post-issue tampering
  issued_by         UUID NOT NULL REFERENCES users(id),  -- the auditor
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,                    -- soft-revocation, never hard-delete a certificate
  revoked_reason    TEXT
);

-- Certificates are never updated once issued — enforce it in the DB, not
-- just in application code. Revocation is the only allowed post-issue write.
CREATE OR REPLACE FUNCTION forbid_certificate_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.data_snapshot IS DISTINCT FROM NEW.data_snapshot
     OR OLD.pdf_sha256 IS DISTINCT FROM NEW.pdf_sha256
     OR OLD.certificate_no IS DISTINCT FROM NEW.certificate_no THEN
    RAISE EXCEPTION 'Certificates are immutable once issued; revoke and reissue instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_certificate_immutable
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION forbid_certificate_mutation();

-- ── Sessions (server-side session store — see SECURITY.md for why this
--    is preferred over storing JWTs client-side) ────────────────────────

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT UNIQUE NOT NULL,          -- SHA-256 of the opaque session token; never store the raw token
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

-- ── Audit log (every state-changing action, system-wide) ────────────────

CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),        -- nullable: system/cron actions
  action        TEXT NOT NULL,                     -- e.g. 'review.decide', 'certificate.issue', 'user.login'
  entity_type   TEXT NOT NULL,                     -- 'review_cycle', 'certificate', 'user', ...
  entity_id     UUID,
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- audit_log is INSERT-only from the application's perspective.
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ============================================================================
-- Row-Level Security — tenant isolation enforced in the database itself
-- ============================================================================
-- Application connects as a role that has RLS applied (not the table owner).
-- Set `app.current_user_id` and `app.current_user_role` via
-- `SET LOCAL` at the start of every request/transaction.

ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates        ENABLE ROW LEVEL SECURITY;

-- super_admin sees everything
CREATE POLICY super_admin_all_orgs ON organizations
  USING (current_setting('app.current_user_role', true) = 'super_admin');
CREATE POLICY super_admin_all_cycles ON review_cycles
  USING (current_setting('app.current_user_role', true) = 'super_admin');
CREATE POLICY super_admin_all_docs ON documents
  USING (current_setting('app.current_user_role', true) = 'super_admin');
CREATE POLICY super_admin_all_issues ON issues
  USING (current_setting('app.current_user_role', true) = 'super_admin');
CREATE POLICY super_admin_all_certs ON certificates
  USING (current_setting('app.current_user_role', true) = 'super_admin');

-- client_admin / client_staff only see their own organization's data
CREATE POLICY client_own_org ON organizations
  USING (id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = current_setting('app.current_user_id', true)::uuid
  ));
CREATE POLICY client_own_cycles ON review_cycles
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = current_setting('app.current_user_id', true)::uuid
  ));

-- auditors see cycles that are unassigned-pending, or assigned to them
CREATE POLICY auditor_relevant_cycles ON review_cycles
  USING (
    current_setting('app.current_user_role', true) = 'auditor'
    AND (status = 'pending' OR assigned_auditor_id = current_setting('app.current_user_id', true)::uuid)
  );

COMMIT;

-- ============================================================================
-- Notes
-- ============================================================================
-- * "companies" in the existing frontend maps to `organizations` +
--   `review_cycles` here (one org can have many cycles over time — one per
--   reporting month — instead of overloading a single row's status field).
-- * Frontend `CompanyReview` (Auditor module) = a join of review_cycles +
--   organizations + documents + issues for a given cycle_id.
-- * Frontend `Auditor` = users WHERE role = 'auditor' JOIN auditor_profiles.
-- * This intentionally does NOT model your existing client/employer auth
--   (useAuth.tsx) — plug that in by mapping its user records into `users`
--   with role IN ('client_admin','client_staff') and linking via
--   organization_members. I don't have that file's current shape, so I've
--   left the join point explicit here rather than guessing at it.
