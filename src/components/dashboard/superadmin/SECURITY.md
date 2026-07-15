# Regnix Platform — Security Architecture

This covers what "take care of security" needs to mean once client, auditor,
and super-admin roles all touch the same system. Ordered by what would hurt
most if skipped.

## 1. Authentication

**Password storage:** `argon2id` (not bcrypt — better resistance to GPU
cracking at equivalent cost), minimum work factor tuned to ~250ms on your
production hardware. Never store, log, or email plaintext passwords.

**Sessions, not client-stored JWTs.** Store an opaque random session token
in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Store only its SHA-256
hash server-side (`sessions.token_hash` in the schema) — if the DB leaks,
the hashes are useless without the original tokens. This avoids the classic
JWT-in-localStorage mistake: any XSS on the site (e.g. a compromised
third-party script) can read localStorage and steal a JWT outright, but
cannot read an `httpOnly` cookie.

**MFA for `auditor` and `super_admin` roles at minimum.** These roles can
issue/revoke compliance certificates and see every client's data — TOTP
(Google Authenticator-style) via a library like `otplib`, secret encrypted
at rest (`mfa_secret_enc`), never stored plaintext.

**Brute-force protection:** `failed_login_count` + `locked_until` columns
are already in the schema — lock an account for a backoff period (e.g.
15 min after 5 failures) and rate-limit the login endpoint by IP
independently of that (e.g. 10 attempts/min/IP via a reverse-proxy rule or
`express-rate-limit`).

## 2. Authorization (RBAC)

Two layers, deliberately redundant:

1. **Application-layer middleware** — every route declares which role(s)
   it accepts (`requireRole('auditor')`, `requireRole('super_admin')`), and
   never queries the database on behalf of a user without pinning
   `organization_id` for client roles.
2. **Database-layer RLS** (see `database-schema.sql`) — even if a route
   handler has a bug and forgets to filter by `organization_id`, the
   database itself refuses to return another company's rows, because the
   Postgres session has `app.current_user_role` / `app.current_user_id`
   set via `SET LOCAL` at the top of every request's transaction.

This defense-in-depth matters specifically here because a single missed
`WHERE organization_id = ?` in one of dozens of routes is exactly the kind
of bug that ships in real codebases — RLS makes that bug non-exploitable
instead of catastrophic.

## 3. Transport & secrets

- HTTPS everywhere, HSTS with `includeSubDomains`, no mixed content.
- All secrets (DB credentials, SMTP credentials, session signing keys) in
  environment variables or a secrets manager (AWS Secrets Manager / GCP
  Secret Manager / Doppler) — never committed, never in `.env` files that
  get accidentally pushed. Add `.env*` to `.gitignore` on day one.
- Rotate the SMTP credentials used by `certificateEmailService.ts`'s
  backend independently from the DB credentials, so a leak of one doesn't
  compromise the other.

## 4. File uploads (documents, certificates)

- Validate MIME type by **content sniffing**, not just the filename
  extension or client-supplied `Content-Type` header (a `.pdf` filename
  proves nothing about the actual bytes).
- Enforce a hard size limit per upload (e.g. 15MB) at the reverse proxy
  *and* the application layer.
- Store files in object storage (S3-compatible) outside the web root, keyed
  by UUID, never by original filename — serve via short-lived signed URLs,
  never a public bucket.
- Store a SHA-256 hash alongside every stored document and certificate PDF
  (`documents.sha256_hash`, `certificates.pdf_sha256` in the schema) so
  tampering or corruption is detectable on retrieval — this is what makes
  the certificate's existing "Tamper Protection Enabled" badge a real,
  checkable claim instead of decoration.

## 5. Input validation

- Validate every request body against a schema (`zod` on the Node side is
  a good fit for a TypeScript stack) before it touches business logic.
- Always use parameterized queries / an ORM's query builder — never string-
  concatenate user input into SQL, including in `admin`-only tooling (admin
  panels are a classic place this rule gets skipped and shouldn't be).

## 6. Audit logging

Every state-changing action writes to `audit_log`: who (`actor_user_id`),
what (`action`), on what (`entity_type`/`entity_id`), and when. The table
is insert-only — `REVOKE UPDATE, DELETE` at the DB grant level, so even a
compromised application credential can't retroactively edit history. This
is also what the Super Admin's Activity view is reading from.

Log at minimum: login (success + failure), certificate issue/revoke,
review decision (approve/changes/reject), document upload, role/permission
changes, and any super-admin action on another user's account.

## 7. Certificate integrity

Certificates are marked immutable at the database level (see the
`forbid_certificate_mutation` trigger) — once issued, a row can only be
revoked, never edited. Combined with the stored `pdf_sha256`, this means:
"was this exact certificate ever altered after issuance" becomes a
yes/no answer backed by a hash comparison, not a trust exercise.

## 8. Data-protection compliance

This platform processes employee PII (names, UAN/PF numbers, wage data)
for Indian entities, so India's **Digital Personal Data Protection Act,
2023 (DPDPA)** is the relevant framework:

- Collect only what's needed for the compliance function itself (data
  minimization) — resist the temptation to store more employee detail than
  the actual filing requires.
- Support data subject requests: an employee (via their employer) should be
  able to request correction or erasure of their data where the underlying
  statutory retention requirement allows it.
- Maintain records of processing purpose — the `audit_log` table doubles as
  a partial answer to "why did we access this record."
- If you ever host data outside India or use a sub-processor (e.g. a US-
  based email provider for `certificateEmailService.ts`'s backend), confirm
  that's compatible with your DPDPA obligations and disclose it in your
  privacy policy.

This is guidance, not legal advice — have an actual lawyer review your
specific data flows before launch, particularly around cross-border data
transfer.

## 9. What to do before go-live (checklist)

- [ ] Argon2id password hashing, no plaintext anywhere (logs included)
- [ ] httpOnly/Secure/SameSite session cookies, no client-stored JWTs
- [ ] MFA enforced for `auditor` and `super_admin` roles
- [ ] Rate limiting on `/login`, `/signup`, `/certificates/send-email`
- [ ] RLS policies applied and tested with a non-owner DB role
- [ ] All file uploads content-sniffed, size-capped, stored outside webroot
- [ ] `audit_log` write on every state-changing route, insert-only grant
- [ ] Secrets in env vars / secrets manager, `.env*` gitignored
- [ ] HTTPS + HSTS in production, no mixed content
- [ ] Dependency scanning (`npm audit` / Snyk / Dependabot) in CI
