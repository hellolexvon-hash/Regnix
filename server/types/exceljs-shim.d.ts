declare module 'exceljs' {
  export type CellValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | CellFormulaValue
    | RichTextValue
    | HyperlinkValue
    | ErrorValue
    | CellSharedFormulaValue;

  export interface CellFormulaValue {
    formula: string;
    result?: CellValue;
  }

  export interface RichTextValue {
    richText: Array<{ text?: string }>;
  }

  export interface HyperlinkValue {
    text?: string;
    hyperlink: string;
  }

  export interface ErrorValue {
    error: string;
  }

  export interface CellSharedFormulaValue {
    sharedFormula: string;
    result?: CellValue;
  }

  export interface CellStyle {
    [key: string]: unknown;
  }

  export interface Cell {
    value: CellValue;
    style: CellStyle;
    numFmt?: string;
    font?: unknown;
    fill?: unknown;
    border?: unknown;
    alignment?: unknown;
    protection?: unknown;
    address: string;
    isMerged: boolean;
    master?: Cell;
  }

  export interface Row {
    height?: number;
    hidden?: boolean;
    outlineLevel?: number;
    cellCount: number;
    values: CellValue[];
    getCell(col: number): Cell;
    eachCell(options: { includeEmpty: boolean }, callback: (cell: Cell, colNumber: number) => void): void;
  }

  export interface Column {
    width?: number;
    hidden?: boolean;
    outlineLevel?: number;
    style?: CellStyle;
    numFmt?: string;
  }

  export interface WorksheetModel {
    merges?: string[];
  }

  export interface Worksheet {
    name: string;
    state?: string;
    properties?: Record<string, unknown>;
    pageSetup?: Record<string, unknown>;
    headerFooter?: Record<string, unknown>;
    views?: unknown[];
    autoFilter?: unknown;
    columnCount: number;
    rowCount: number;
    columns: Column[];
    model: WorksheetModel;
    getCell(row: number, col: number): Cell;
    getCell(address: string): Cell;
    getRow(rowNumber: number): Row;
    getColumn(column: number): Column;
    eachRow(options: { includeEmpty: boolean }, callback: (row: Row, rowNumber: number) => void): void;
    mergeCells(range: string): void;
    spliceRows(start: number, count: number, ...inserts: CellValue[][]): void;
  }

  export interface Xlsx {
    load(buffer: ArrayBuffer): Promise<void>;
    writeBuffer(): Promise<ArrayBuffer | Buffer>;
  }

  export class Workbook {
    creator: string;
    created: Date;
    modified: Date;
    worksheets: Worksheet[];
    xlsx: Xlsx;
    getWorksheet(id: number | string): Worksheet | undefined;
    addWorksheet(name: string): Worksheet;
  }

  const ExcelJS: {
    Workbook: typeof Workbook;
  };

  export default ExcelJS;
}
