import { SupportedParamType } from "./primitives.js";

/**
 * @ignore
 */
export enum ScryptType {
  BOOL = 'bool',
  INT = 'int',
  BYTES = 'bytes',
  PUBKEY = 'PubKey',
  PRIVKEY = 'PrivKey',
  SIG = 'Sig',
  RIPEMD160 = 'Ripemd160',
  PubKeyHash = 'PubKeyHash',
  SHA1 = 'Sha1',
  SHA256 = 'Sha256',
  SIGHASHTYPE = 'SigHashType',
  SIGHASHPREIMAGE = 'SigHashPreimage',
  OPCODETYPE = 'OpCodeType',
}

/**
 * @ignore
 */
export enum SymbolType {
  ScryptType = 'ScryptType',
  Contract = 'Contract',
  Library = 'Library',
  Struct = 'Struct',
  Unknown = 'Unknown',
}

/**
 * @ignore
 */
export type TypeInfo = {
  info?: unknown;
  generic: boolean;
  finalType: string;
  symbolType: SymbolType;
};

/**
 * A type resolver that can resolve type aliases to final types
 * @ignore
 */
export type TypeResolver = (type: string) => TypeInfo;

/**
 * @ignore
 */
export function isScryptType(type: string): boolean {
  return Object.keys(ScryptType)
    .map((key) => ScryptType[key])
    .includes(type);
}

/**
 * @ignore
 */
export function isSubBytes(type: string): boolean {
  return [
    ScryptType.OPCODETYPE,
    ScryptType.PUBKEY,
    ScryptType.RIPEMD160,
    ScryptType.SHA1,
    ScryptType.SHA256,
    ScryptType.SIG,
    ScryptType.SIGHASHPREIMAGE,
    ScryptType.SIGHASHTYPE,
    ScryptType.PubKeyHash,
  ]
    .map((t) => t.toString())
    .includes(type);
}

/**
 * @ignore
 */
export function isBytes(type: string): boolean {
  return type === ScryptType.BYTES || isSubBytes(type);
}




/**
 * @ignore
 */
export interface Argument {
  name: string;
  type: string;
  value: SupportedParamType;
}

/**
 * @ignore
 */
export type Arguments = Argument[];
