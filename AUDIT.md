# Audit findings (from the files supplied)

## A. Column-number errors (verified against the real template headers)
| Where | Resolves to | Should be |
|---|---|---|
| `CLRA.totalWoHolidays` (uses `MASTER_COLUMNS.lwpDays`) | 275 Leave Without Pay | **201** Total number of Week Offs/Holidays/leaves |
| `CLRA.amountOfAdvance` (uses `MASTER_COLUMNS.advanceRefund`) | 266 Amount *Refund* of advances | **218** Amount of advance given |
| `CLRA.amountPerInstallment` (uses `MASTER_COLUMNS.estimatedDamage`) | 293 Estimated damage | **294** Amount per Installment |
| `CLRA.employeeLwf` | 247 Employer LWF | **248** Employee LWF |
| `CLRA.employerEpfDiff` | 238 Employer PF | **264** EPF and EPS differences |
| `CLRA.damageRemarks` | 222 *Advances* remarks | **213** Deductions-for-damage remarks |
| `CLRA.advanceRemarks` | 217 *Fines* remarks | **222** Advances remarks |
| `CLRA.edliEmployer05` | 261 EDLI *wages* | no EDLI-amount column exists in the master |
| `MASTER.govt*` (6 keys) | 561-566 | beyond column 560 — always blank |
Also check: `CLRA.totalLop` → 312 is "Total Damages/Loss of pay", probably meant 275/265; `amountOfFine` is 215 in MASTER but 302 in CLRA (two fine-amount columns exist).

## B. Master workbook
* Column list and sheet agree (559 headers). **JY (285) has no header**; SK/SL/SM are "Unnamed".
* Exact duplicate headers: "Nature of employment/designation" (42, 44), "Bonus Eligibility" (255, 286). Anything keyed by header text (legacy `server/lib/masterReader.ts`) silently loses one.
* Legacy `server/lib/masterReader.ts` picks the first row with ≥2 text cells as the header — that is **row 1 (section names)**, not row 2. Do not use it; `services/shared/masterReader.ts` is correct.
* The same fact lives in many columns (contractor ×5, DOJ ×4, Aadhaar ×2, ESIC IP ×3 …). The CLRA mapping notes show some are empty in real data while siblings are filled — the engine now syncs them (`SYNC_GROUPS`).
* The CLRA mapping comments say col 87 (DOB) holds marital status and col 73 holds age/sex in real rows → data is shifted under some headers. The engine's `COLUMN_TYPE_MISMATCH` check will flag this the first time you run real data.

## C. COLUMN_MAP formulas that are wrong or inconsistent
* Employer PF admin charges uses the PF formula (1,800 cap) — admin is 0.5% of EPF wages.
* "Employer ESI Registration" (451) has an ESIC-percentage formula — it is a registration number.
* ESIC Employee is marked *Manual Entry* but has a formula.
* Bonus: `gross × 8.33%` / flat 3,500 is not the Bonus Act rule (8.33% of min(wage, max(₹7,000, minimum wage)); eligible if ≤ ₹21,000).
* Gratuity eligibility: header says "4.6 years", formula says +5 years. Engine uses 5 (`gratuityYears`).
* CTC formula omits employer PF/ESIC; "CTC" (283) and "CTC (Annual)" (272) are duplicates.
* Overtime formula uses Basic only; statute uses ordinary rate incl. DA — engine uses (Basic+DA+VDA)/26/8.

## D. Security (outside the populate task — not changed)
* `superAdminRoute.requireAdminToken` **fails open**: if `ADMIN_API_TOKEN` is unset every `/admin/*` route is public. Compare tokens with `timingSafeEqual`.
* `certificateRoute /certificate/email` is unauthenticated and accepts arbitrary recipient/text/html/PDF → anyone can send mail from your domain.
* `auditorRoute` has no authentication on `/auditor/reviews/decision` (approve + issue certificate) and `/auditor/auth/signup` upserts into `profiles` with `account_type:'auditor'` → privilege escalation.
* `validationRoute` reads/overwrites any session knowing a user UUID; delete-then-insert of documents is not transactional.
* Upload `fileFilter` silently drops files with another MIME type (browsers often send `application/octet-stream` for .xlsx) and the handler then says "Master workbook is required".
* `masterReader.formatDate` uses local-time getters on UTC dates; fine on Vercel (UTC) but shifts a day on a server west of UTC.
* Duplicates to delete: top-level `routes/`, `server/delete/`, `server/routes/delete/`, `server/services/*/delete/`, `services.zip`.
