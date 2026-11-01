/**
 * State PT / LWF tables — EDIT THIS FILE. Kept as TypeScript (not JSON) so it bundles on Vercel/tsx
 * with no import-attribute or resolveJsonModule dependency. See _readme for the verified flag.
 */
export const STATUTORY_TABLES = {
  "_readme": "State-wise Professional Tax and Labour Welfare Fund tables. Slabs change by notification, so every entry carries verified:true/false. The engine only uses verified:false entries when PopulateConfig.allowUnverifiedTables is true; otherwise PT/LWF stay blank and are reported as a gap. Set verified:true only after checking the current state notification. amounts are rupees per payroll month (PT) or per deduction event (LWF).",
  "pt": {
    "Maharashtra": {
      "verified": false, "frequency": "Monthly", "notes": "Feb amount differs. Women exempt up to 25,000.",
      "slabs": [
        { "gender": "Male",   "min": 0,     "max": 7500,  "amount": 0 },
        { "gender": "Male",   "min": 7500.01, "max": 10000, "amount": 175 },
        { "gender": "Male",   "min": 10000.01, "max": null, "amount": 200, "feb": 300 },
        { "gender": "Female", "min": 0,     "max": 25000, "amount": 0 },
        { "gender": "Female", "min": 25000.01, "max": null, "amount": 200, "feb": 300 },
        { "gender": "Other",  "min": 0,     "max": 7500,  "amount": 0 },
        { "gender": "Other",  "min": 7500.01, "max": 10000, "amount": 175 },
        { "gender": "Other",  "min": 10000.01, "max": null, "amount": 200, "feb": 300 }
      ]
    },
    "Karnataka": {
      "verified": false, "frequency": "Monthly", "notes": "Threshold revised in 2025; Feb amount differs.",
      "slabs": [
        { "gender": "any", "min": 0,     "max": 24999.99, "amount": 0 },
        { "gender": "any", "min": 25000, "max": null,     "amount": 200, "feb": 300 }
      ]
    },
    "Telangana": {
      "verified": false, "frequency": "Monthly",
      "slabs": [
        { "gender": "any", "min": 0,        "max": 15000, "amount": 0 },
        { "gender": "any", "min": 15000.01, "max": 20000, "amount": 150 },
        { "gender": "any", "min": 20000.01, "max": null,  "amount": 200 }
      ]
    },
    "West Bengal": {
      "verified": false, "frequency": "Monthly",
      "slabs": [
        { "gender": "any", "min": 0,        "max": 10000, "amount": 0 },
        { "gender": "any", "min": 10000.01, "max": 15000, "amount": 110 },
        { "gender": "any", "min": 15000.01, "max": 25000, "amount": 130 },
        { "gender": "any", "min": 25000.01, "max": 40000, "amount": 150 },
        { "gender": "any", "min": 40000.01, "max": null,  "amount": 200 }
      ]
    },
    "Gujarat": {
      "verified": false, "frequency": "Monthly",
      "slabs": [
        { "gender": "any", "min": 0,        "max": 12000, "amount": 0 },
        { "gender": "any", "min": 12000.01, "max": null,  "amount": 200 }
      ]
    }
  },
  "noPt": ["Delhi", "Haryana", "Rajasthan", "Uttar Pradesh"],
  "lwf": {
    "_example": {
      "verified": false, "frequency": "Half-yearly", "months": [6, 12],
      "employee": 0, "employer": 0,
      "notes": "Copy this block under the state name and fill current amounts; months = calendar months (1-12) in which the deduction falls."
    }
  },
  "noLwf": [],
  "aliases": { "mh": "Maharashtra", "ka": "Karnataka", "tg": "Telangana", "ts": "Telangana", "wb": "West Bengal", "gj": "Gujarat", "dl": "Delhi", "hr": "Haryana", "rj": "Rajasthan", "up": "Uttar Pradesh", "tn": "Tamil Nadu", "ap": "Andhra Pradesh", "kl": "Kerala", "pb": "Punjab", "od": "Odisha", "or": "Odisha", "as": "Assam", "ml": "Meghalaya" }
};
