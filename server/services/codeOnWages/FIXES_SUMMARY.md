# Code on Wages Registers — What was wrong, and what I fixed

I cross-checked every generator against the actual master data headers and the
actual template files (not just the code comments, which had drifted from
reality). Below are the real bugs found, grouped by severity, followed by the
6 regenerated registers.

## 1. The big one: wrong template file for Form II (Muster Roll cum Wage Register)
`musterRollCumWageRegister.ts` is written for an **85-column** layout (UAN,
PF number, PT, ESI, LWF, income tax, govt-wage comparison, etc.). But the
template actually wired up at that path (`Form_II_Muster_Roll_cum_Wage_Register.xlsx`)
is a **different, simpler 64-column** template with no PF/ESI/PT/tax
breakdown at all. Every column from C5 onward was landing on the wrong
field. The file you separately uploaded as `Form_II_Muster_Roll_cum_Wage_Register_1_.xlsx`
**is** the correct 85-column template — I used that one to regenerate the
register, and flagged the swap in `index.ts`.

That template's row layout is also different than the code assumed: data
rows run **12–29** (18-row capacity), not 12–19, and there's no pre-built
totals row — the first free row is 30 (row 33 has the signature line).

## 2. Meta-info cells (Establishment Name / Address / Reg No. / Year / Nature of Industry / Month) were one row too high, in every form
The templates' labels sit on **rows 4–7**; the code was writing to rows
3–6. Also, "Establishment Name" and "Address" turned out to share **one
merged cell** (not two separate ones), so both lines now go into that single
cell. Affected: Fines, Deductions, Overtime, Wage Register, and (with
different column letters) the Muster-cum-Wage register.

## 3. Form I (Fines) total row was overwriting the statutory footnote
Row 19 in that template is legal footnote text, not a totals row (unlike
every other form, which has one). The old code wrote totals straight into
row 19, silently deleting the footnote every time. Fixed by always reserving
one extra blank row for totals before the footnote.

## 4. Column mismatches in `mapping.ts` (verified against the actual master headers)
| Field | Was pointing at | Should point at |
|---|---|---|
| `lwpDays` (Form VI) | col 201 "Total Week Offs/Holidays" | col 275 "Leave Without Pay (LWP) Days" |
| `otHoursMusterRoll` (Form VI) | col 275 (LWP Days!) | col 440 "Total Overtime Hours Worked" |
| `totalOtHours` (Form III) | col 190 "Total Hours worked" | col 440 "Total Overtime Hours Worked" |
| `normalRateOfWages` (Form III) | col 204 (a **daily** rate) | col 225 "Normal rate of wages" (₹/hr — confirmed by OT rate = exactly 2× this value) |
| `wagePeriodRecovery` / `amountRecoveredDamage` (Form II) | swapped (304↔307) | 307 = wage period (text), 304 = amount (number) |
| `additionalComponent` | col 336 "Society Deduction" | col 236 "Additional Salary Component" |
| `incomeTax` | col 339 "Subsistance allowance" | col 356 "TDS Amount" |
| `baseWorkLocation` | col 526 "Address of Employer" | col 48 "Work Location" |
| `endClientName` | col 525 (the **contractor's own** name) | col 392 "Name of the principal employer" (the actual end client) |
| `dateOfEntryIntoService` | col 270 "EPF Date of Joining" | col 66 "Date of entry into service" |
| `lopLoss` (Muster-cum-Wage) | col 312 (a ₹ figure) | col 275 (LWP days — the template column is a day-count) |
| `basicWage` in Muster-cum-Wage col 53 | was using `minWageBasic` | now uses `basicWage` (284); col 50 "Minimum rates of wages" was never filled — now is |
| `projectName` | col 44 (actually "Nature of employment/designation") | **no matching column exists** in this master layout — left blank rather than guessed |

## 5. Smaller fixes
- `overtimeRegister.ts` / `wageRegister.ts`: the "TOTAL →" / "TOTALS" label text was being cleared and never rewritten — restored.
- `musterRollCumWageRegister.ts`: gross-salary total was written to `BC` (column 55) instead of `BM` (column 65).
- **openpyxl/row-insertion bug** (only relevant to how I regenerated the files, not your TS code): inserting rows to make room for the 11th employee left stale merged-cell ranges behind, which silently dropped 2 employees' data on save. Worked around by relocating merges before inserting rows.

## Files
- `Code_on_Wages_Registers/` — the 6 regenerated registers, correct data + correct company header + preserved template styling.
- `fixed_source/` — every `.ts` file with the fixes applied (diff-able against your originals). `mapping.ts` and `musterRollCumWageRegister.ts` have the most changes; `index.ts` has one comment flagging the template-file swap.

## Still open (couldn't fix without more info)
- `projectName` and the govt-wage-comparison columns (561–566) have no
  corresponding column in this master data layout — they're left blank
  rather than mapped to something wrong. If those exist elsewhere in your
  real master sheet, tell me the column numbers and I'll wire them in.
