declare const process: {
  cwd(): string;
};

declare const console: {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare function structuredClone<T>(value: T): T;

declare class Buffer extends Uint8Array {
  constructor(input: string | ArrayBuffer | ArrayBufferView | readonly number[]);
  static from(data: string | ArrayBuffer | ArrayBufferView | readonly number[], encoding?: string): Buffer;
  static from(data: ArrayBuffer | ArrayBufferView): Buffer;
  static isBuffer(value: unknown): value is Buffer;
  static alloc(size: number): Buffer;
  static concat(list: readonly Buffer[], totalLength?: number): Buffer;
  readonly length: number;
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
  slice(start?: number, end?: number): Buffer;
  toString(encoding?: string): string;
  writeUInt32LE(value: number, offset: number): number;
  writeUInt16LE(value: number, offset: number): number;
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): Buffer;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module 'node:zlib' {
  export function deflateRawSync(buffer: Buffer): Buffer;
}

declare module 'exceljs';
