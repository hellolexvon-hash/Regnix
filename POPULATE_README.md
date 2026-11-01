# Regnix master populate engine

Drop-in files (same layout as your repo):
```
server/services/populate/{fields,normalize,config,rules,ingest,validate,acts,engine,report,index}.ts
server/services/populate/statutoryTables.json
server/routes/populateRoute.ts        → app.use('/api', populateRoute)
scripts/{populate-cli,makeFixture,selftest,routeSmoke,auditColumns}.ts
```
Needs only `exceljs` (already used). `tsconfig` must allow `resolveJsonModule` and `import … with { type: 'json' }`.

## What it does
1. Loads the master and **verifies every registered column against its header text** (fails loudly if the template drifts).
2. Optionally merges one or more source files (.xlsx/.csv): header auto-match (explicit → alias → exact → fuzzy ≥0.85; 1–31 → attendance), rows joined by Employee code → UAN → Aadhaar → PAN; unmatched rows appended.
3. Normalises formats (dates, Aadhaar/PAN/UAN/IFSC/mobile, gender, Yes/No; IDs written as text so leading zeros survive).
4. Copies values between duplicate columns.
5. Derives blanks through ordered rules (attendance → rates → OT → gross → age → EPF → ESIC → bonus → gratuity → PT → LWF → deductions → net → CTC; apprentice stipend).
6. Validates (checksums, duplicates, child labour, date logic, column-content-vs-header).
7. Writes `…_POPULATED.xlsx` + `Populate_Report.xlsx` + `populate_report.json`.

Never overwrites an existing value: differences go to *Source conflicts* / *Discrepancies*. A rule with a blank or unusable input leaves the target blank and reports why.

## Decisions you must confirm (all in `config.ts`)
`epfWagesIncludeDA`, `esicIncludesOT`, `gratuityYears` (5 vs header's 4.6), `ctcIncludesEmployerStatutory`, bonus rule, OT ordinary rate.

## PT / LWF
`statutoryTables.json` ships PT slabs for MH, KA, TG, WB, GJ marked `verified:false` and an **empty LWF table**. Until you verify and flip `verified:true`, PT/LWF stay blank, and so do Total Deduction / Net Salary / Net payments (they need them). The route never lets a client enable unverified tables.

## Run
```
npx tsx scripts/selftest.ts                       # 22 checks on a synthetic fixture
npx tsx scripts/populate-cli.ts --master M.xlsx --source payroll.xlsx --out out --asof 2026-10-31
```
