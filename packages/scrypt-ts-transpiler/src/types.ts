import ts from 'typescript';

/**
 * @ignore
 */
export interface Range {
  fileName: string;
  start: ts.LineAndCharacter;
  end: ts.LineAndCharacter;
}

/**
 * @ignore
 * Errors that may occur when the transpiler translates sCrypt contracts.
 */
export class TranspileError {
  message: string;
  srcRange: Range;
  constructor(message: string, srcRange: Range) {
    this.message = message;
    this.srcRange = srcRange;
    this.srcRange.start.line++;
    this.srcRange.start.character++;
    this.srcRange.end.line++;
    this.srcRange.end.character++;
  }
}

export class UnknownError extends Error {
  srcRange: Range;
  constructor(message: string, srcRange: Range) {
    super(`UnknownError: ${message}`);
    this.message = message;
    this.srcRange = srcRange;
    this.srcRange.start.line++;
    this.srcRange.start.character++;
    this.srcRange.end.line++;
    this.srcRange.end.character++;
  }
}

/**
 * @ignore
 */
export type TransformationResult = {
  success: boolean;
  errors: TranspileError[];
  scryptfile: string;
  sourceMapFile: string;
  ctxMethods: string[];
};
