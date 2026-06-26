# Code on Wages — Column Editing Guide

## Where to find and edit column numbers

### Step 1 — Find the master column number
All 560+ master register columns are mapped in:

```
server/services/shared/masterColumns.ts
```

Each entry looks like: `basicWage: 284,  // JX — Basic Wage`
The number is the Excel **column position** in the Master Register sheet.

### Step 2 — Check the act-specific alias
The Code on Wages forms use friendly names via:

```
server/services/codeOnWages/mapping.ts
```

This file imports from `masterColumns.ts` and re-exports only what the forms need.
Change a mapping here if you want a form to read from a **different** master column.

Example — to change OT Amount in Form IV from col 227 to col 207:
```ts
// mapping.ts
otAmountFormIV: MASTER_COLUMNS.otAmount,  // change to otAmountFormIV: 207
```

### Step 3 — Check which template column it maps to
Each register file has a clear COLUMN MAP comment at the top showing:

```
C13 → otAmount   227   ← Form IV OT col CORRECTED
```

Template column C13 reads master col 227. To move it, change `mapping.ts`.

---

## Summary of all corrected columns (vs original broken code)

| Form   | Field                  | Old col | Correct col |
|--------|------------------------|---------|-------------|
| All    | Nature of Industry     | 394     | **38**      |
| All    | Employee Name          | missing | **401**     |
| I      | Date Offence Noticed   | 295     | **299**     |
| I      | Date Show Cause        | 296     | **406**     |
| I      | Amount Fine            | missing | **215**     |
| I      | Date Recovery          | missing | **303**     |
| I      | Amount Recovered       | missing | **304**     |
| I      | Balance Pending        | missing | **436**     |
| I      | Remarks                | missing | **217**     |
| II     | Dept                   | missing | **46**      |
| II     | Nature of Damage       | missing | **209**     |
| II     | Estimated Damage       | missing | **293**     |
| II     | Wage Period Recovery   | 307     | **304**     |
| II     | Amount Recovered       | 304     | **307**     |
| III    | Normal Wage Rate       | 225     | **204** (daily)|
| III    | Total OT Hours         | 440     | **190**     |
| IV     | Basic Wage             | 259     | **284**     |
| IV     | DA                     | 205     | **229**     |
| IV     | HRA                    | wrong   | **230**     |
| IV     | Conveyance             | wrong   | **233**     |
| IV     | Special Allowance      | wrong   | **235**     |
| IV     | OT Amount              | 207     | **227**     |
| IV     | Gross Salary           | 274     | **273**     |
| IV     | Employee PF            | 238     | **262**     |
| IV     | ESIC Employee          | wrong   | **243**     |
| IV     | Advance                | 266     | **218**     |
| IV     | Net Salary             | 208/275 | **274**     |
| VI     | Total Present          | 246     | **199**     |
| VI     | LOP Days               | 312     | **201**     |
| VI     | OT Hours               | 207     | **275**     |

## Page capacity (rows per sheet)

| Form | dataStartRow | dataEndRow | Template rows |
|------|-------------|------------|---------------|
| I    | 11          | 18         | 8             |
| II   | 11          | 15         | 5             |
| III  | 11          | 16         | 6             |
| IV   | 11          | 18         | 8             |
| VI   | 10          | 15         | 6             |
| II Muster | 12   | 19         | 8             |

**Note:** The engine auto-inserts extra rows if there are more employees than template rows.
All employees now appear on a single sheet (no pagination).
