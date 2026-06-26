// ─── Core domain types ────────────────────────────────────────────────────────

export type Binary = ArrayBuffer | Uint8Array | Buffer;

/** One employee row read from the master workbook */
export interface EmployeeRow {
  [column: string]: string | number | Date | null;
}

/** Options passed to the document-generation service */
export interface GenerateOptions {
  masterFile:    Binary;
  selectedActs?: string[];   // act IDs from the frontend
  state?:        string;     // company state (for SE Act template selection)
  templatesDir?: string;     // override auto-detected templates root
}

/** What the service returns */
export interface GenerateResult {
  zipBuffer: Buffer;
  fileNames: string[];
  rowCount:  number;
}

/** Structured API error */
export interface ApiError {
  error:    string;
  details?: string;
}
