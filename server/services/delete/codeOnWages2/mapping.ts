/**
 * codeOnWages/mapping.ts
 *
 * Single source of truth for Code on Wages master column mappings.
 * Only fixed numeric master column indices are exported.
 * No header text lookup. No act logic.
 */

import { columnLetterToNumber } from '../shared/excelUtils.js';

type ColumnMap = Record<number, number>;

function fromLetterMap(source: Record<string, number>): ColumnMap {
  const target: ColumnMap = {};
  for (const [templateLetter, masterCol] of Object.entries(source)) {
    const templateCol = columnLetterToNumber(templateLetter);
    target[templateCol] = masterCol;
  }
  return Object.freeze(target);
}

const FORM_I_ROW_11 = fromLetterMap({
  A: 1,
  B: 9,
  C: 401,
  D: 46,
  E: 47,
  F: 295,
  G: 301,
  H: 295,
  I: 296,
  J: 300,
  K: 432,
  L: 215,
  M: 303,
  N: 302,
  O: 436,
  P: 217,
});

const FORM_II_ROW_11 = fromLetterMap({
  A: 1,
  B: 9,
  C: 401,
  D: 46,
  E: 47,
  F: 210,
  G: 209,
  H: 293,
  I: 296,
  J: 435,
  K: 305,
  L: 306,
  M: 307,
  N: 304,
  O: 436,
  P: 308,
  Q: 309,
  R: 213,
});

const FORM_III_ROW_11 = fromLetterMap({
  A: 1,
  B: 9,
  C: 401,
  D: 46,
  E: 47,
  F: 225,
  G: 187,
  H: 183,
  I: 184,
  J: 185,
  K: 186,
  L: 440,
  M: 207,
  N: 311,
  O: 398,
  P: 514,
});

const FORM_IV_ROW_11 = fromLetterMap({
  A: 1,
  B: 9,
  C: 401,
  D: 46,
  E: 47,
  F: 246,
  G: 200,
  H: 284,
  I: 285,
  J: 230,
  K: 233,
  L: 235,
  M: 207,
  N: 273,
  O: 238,
  P: 243,
  Q: 251,
  R: 266,
  S: 310,
  T: 292,
  U: 208,
  V: 311,
  X: 398,
  Y: 503,
});

const FORM_VI_ROW_10 = fromLetterMap({
  A: 1,
  B: 9,
  C: 401,
  D: 47,
  E: 144,
  F: 145,
  G: 146,
  H: 147,
  I: 148,
  J: 149,
  K: 150,
  L: 151,
  M: 152,
  N: 153,
  O: 154,
  P: 155,
  Q: 156,
  R: 157,
  S: 158,
  T: 159,
  U: 160,
  V: 161,
  W: 162,
  X: 163,
  Y: 164,
  Z: 165,
  AA: 166,
  AB: 167,
  AC: 168,
  AD: 169,
  AE: 170,
  AF: 171,
  AG: 172,
  AH: 173,
  AI: 174,
  AJ: 246,
  AK: 200,
  AL: 94,
  AM: 207,
  AN: 503,
});

export const CODE_WAGES_MAPPING = Object.freeze({
  formI: FORM_I_ROW_11,
  formII: FORM_II_ROW_11,
  formIII: FORM_III_ROW_11,
  formIV: FORM_IV_ROW_11,
  formVI: FORM_VI_ROW_10,
} as const);

export const FORM_I_MAPPING = FORM_I_ROW_11;
export const FORM_II_MAPPING = FORM_II_ROW_11;
export const FORM_III_MAPPING = FORM_III_ROW_11;
export const FORM_IV_MAPPING = FORM_IV_ROW_11;
export const FORM_VI_MAPPING = FORM_VI_ROW_10;

export type CodeWagesFormKey = keyof typeof CODE_WAGES_MAPPING;
