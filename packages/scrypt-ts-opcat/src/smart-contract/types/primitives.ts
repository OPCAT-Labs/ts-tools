import { Flavor } from '../../globalTypes.js';
import { getValidatedHexString } from './utils.js';

/**
 * A ByteString represents a byte array in hex format.
 * @category Types
 * @onchain
 */
export type ByteString = Flavor<string, 'bytes'>;

/**
 * A Int32 represents a number.
 * @category Types
 * @onchain
 */
export type Int32 = Flavor<bigint, 'int'>;

/**
 * A Bool represents a boolean. A simple value true or false.
 * @category Types
 * @onchain
 */
export type Bool = Flavor<boolean, 'bool'>;

/**
 * A domain specific subtype of `Int32`, representing a private key.
 * @category Types
 * @onchain
 */
export type PrivKey = Int32 & { __type: 'PrivKey' };

/**
 * Creates a `PrivKey` instance from a `Int32`.
 * @category Global Function
 * @onchain
 * @param key - Input Int32.
 * @returns - A domain specific private key representation.
 */
export function PrivKey(n: Int32): PrivKey {
  return n as PrivKey;
}

/**
 * A domain specific subtype of `ByteString`, representing a public key.
 * @category Types
 * @onchain
 */
export type PubKey = ByteString & { __type: 'PubKey' };
/**
 * Creates a `PubKey` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific public key representation.
 */
export function PubKey(b: ByteString): PubKey {
  return getValidatedHexString(b, false) as PubKey;
}

/**
 * A domain specific subtype of `ByteString`, representing an x-only public key.
 * @category Types
 * @onchain
 */
export type XOnlyPubKey = ByteString & { __type: 'XOnlyPubKey' };
/**
 * Creates an `Addr` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific address representation.
 */
export function XOnlyPubKey(b: ByteString): XOnlyPubKey {
  const hex = getValidatedHexString(b, false);

  if (hex.length / 2 !== 32) {
    throw new Error(`XOnlyPubKey should have 32 bytes length`);
  }

  return hex as XOnlyPubKey;
}

/**
 * A domain specific subtype of `ByteString`, representing a signature.
 * @category Types
 * @onchain
 */
export type Sig = ByteString & { __type: 'Sig' };
/**
 * Creates a `Sig` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific digital signature representation.
 */
export function Sig(b: ByteString): Sig {
  return getValidatedHexString(b, false) as Sig;
}

/**
 * A domain specific subtype of `ByteString`, representing a RIPEMD-160 hash.
 * @category Types
 * @onchain
 */
export type Ripemd160 = ByteString & { __type: 'Ripemd160' };
/**
 * Creates a `Ripemd160` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific RIPEMD-160 hash representation.
 */
export function Ripemd160(b: ByteString): Ripemd160 {
  return getValidatedHexString(b, false) as Ripemd160;
}

/**
 * A domain specific subtype of `ByteString`, representing an address.
 * @category Types
 * @onchain
 */
export type PubKeyHash = Ripemd160;
/**
 * Creates a `PubKeyHash` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific address representation.
 */
export function PubKeyHash(b: ByteString): PubKeyHash {
  return Ripemd160(b);
}

/**
 * A domain specific subtype of `ByteString`, representing an address.
 * @category Types
 * @onchain
 */
export type Addr = PubKeyHash;
/**
 * Creates an `Addr` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific address representation.
 */
export function Addr(b: ByteString): Addr {
  return PubKeyHash(b);
}

/**
 * A domain specific subtype of `ByteString`, representing a SHA-1 hash.
 * @category Types
 * @onchain
 */
export type Sha1 = ByteString & { __type: 'Sha1' };
/**
 * Creates a `Sha1` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific SHA-1 hash representation.
 */
export function Sha1(b: ByteString): Sha1 {
  return getValidatedHexString(b, false) as Sha1;
}

/**
 * A domain specific subtype of `ByteString`, representing a SHA-256 hash.
 * @category Types
 * @onchain
 */
export type Sha256 = ByteString & { __type: 'Sha256' };

/**
 * Creates a `Sha256` instance from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific SHA-256 hash representation.
 */
export function Sha256(b: ByteString): Sha256 {
  return getValidatedHexString(b, false) as Sha256;
}

/**
 * An array is a fixed-size list of values of the same basic type.
 * When you declare an array you have to declare it like this:
 * @category Types
 * @onchain
 * @example
 *  ```ts
 * let aaa: FixedArray<bigint, 3> = [1n, 3n, 3n];
 *
 * let abb: FixedArray<FixedArray<bigint, 2>, 3> = [[1n, 3n], [1n, 3n], [1n, 3n]];
 *
 * let bbb: FixedArray<FixedArray<FixedArray<bigint, 1>, 2>, 3> = [[[1n], [1n]], [[1n], [1n]], [[1n], [1n]]];
 * ```
 */
export type FixedArray<T, N extends number> = Array<T> & { length: N };

/**
 * A domain specific subtype of `ByteString`, representing a signature hash type.
 * @category Types
 * @onchain
 * ref https://github.com/bitcoin/bitcoin/blob/c288c790cd9abe91e53164aba5d975ef1e26ee3f/src/script/interpreter.h#L30-L33
 */
export const enum SigHashType {
  DEFAULT = '00',
  ALL = '01',
  NONE = '02',
  SINGLE = '03',
  ANYONECANPAY = '80',
  ANYONECANPAY_ALL = '81',
  ANYONECANPAY_NONE = '82',
  ANYONECANPAY_SINGLE = '83',
}

/**
 * A domain specific subtype of `ByteString`, representing a Script word.
 * @category Types
 * @onchain
 */
export type OpCodeType = ByteString & { __type: 'OpCodeType' };

/**
 * Creates a `OpCodeType` from a `ByteString`.
 * @category Global Function
 * @onchain
 * @param b - Input ByteString.
 * @returns - A domain specific OpCodeType representation.
 */
export function OpCodeType(b: ByteString): OpCodeType {
  return getValidatedHexString(b, false) as OpCodeType;
}

/**
 * @ignore
 */
export type PrimitiveTypes =
  | Int32
  | Bool
  | ByteString
  | PrivKey
  | PubKey
  | XOnlyPubKey
  | Sig
  | Sha256
  | Sha1
  // enum type is not supported currently
  // | SigHashType
  | Ripemd160
  | OpCodeType;

/**
 * @ignore
 */
export type SubBytes = PubKey | Sig | Sha256 | Sha1 | SigHashType | Ripemd160 | OpCodeType;

/**
 * @ignore
 */
export interface StructObject {
  [key: string]: SupportedParamType;
}

/**
 * @ignore
 */
export type SupportedParamType = PrimitiveTypes | StructObject | SupportedParamType[];



export type OpcatState = StructObject | undefined