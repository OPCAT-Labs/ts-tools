import { assert, intToByteString, toByteString } from './fns/index.js';
import { Bool, ByteString, Int32, PrimitiveTypes } from './types/primitives.js';
import * as tools from 'uint8array-tools';
import { Script } from './types/script.js';
import { uint8ArrayToHex } from '../utils/common.js';
import { TX_IO_INDEX_VAL_MIN, TX_IO_INDEX_VAL_MAX } from './consts.js';
import { Outpoint } from './types/structs.js';
import { BufferReader } from '../psbt/bufferutils.js';
/**
 * @ignore
 * int to little-endian signed magnitude
 */
export function int2hex(n: Int32): string {
  if (n === BigInt(0)) {
    return '00';
  } else if (n === BigInt(-1)) {
    return '4f';
  } else if (n > BigInt(0) && n <= BigInt(16)) {
    n += BigInt(80);
    return n.toString(16);
  }
  return Script.fromASM(intToByteString(n)).toHex();
}

/**
 * @ignore
 * @param n
 * @returns
 */
export function int2ScriptSig(n: Int32): Uint8Array {
  if (n === BigInt(0)) {
    return tools.fromHex('');
  }

  return tools.fromHex(intToByteString(n));
}

/**
 * @ignore
 * @param b
 * @returns
 */
export function bool2hex(b: Bool): string {
  if (b) {
    return '51';
  }
  return '00';
}

/**
 * @ignore
 * @param b
 * @returns
 */
export function bool2ScriptSig(b: Bool): Uint8Array {
  if (b) {
    return tools.fromHex('01');
  }
  return tools.fromHex('');
}

/**
 * @ignore
 * @param b
 * @returns
 */
export function bytes2hex(b: ByteString): string {
  if (b) {
    if (b.length / 2 > 1) {
      return Script.fromASM(b).toHex();
    }

    const intValue = parseInt(b, 16);

    if (intValue >= 1 && intValue <= 16) {
      return BigInt(intValue + 80).toString(16);
    }

    return Script.fromASM(b).toHex();
  }
  return '00';
}

/**
 * @ignore
 * @param b
 * @returns
 */
export function bytes2ScriptSig(b: ByteString): Uint8Array {
  return tools.fromHex(b);
}

/**
 * @ignore
 * @param x
 * @returns
 */
export function toScriptHex(x: PrimitiveTypes): string {
  if (typeof x === 'number' || typeof x === 'bigint') {
    return int2hex(x as bigint);
  } else if (typeof x === 'boolean') {
    return bool2hex(x as boolean);
  } else if (typeof x === 'string') {
    return bytes2hex(x);
  }

  throw new Error(`unsupport PrimitiveTypes: ${x}`);
}

/**
 * @ignore
 * @param x
 * @returns
 */
export function toScriptSig(x: PrimitiveTypes): Uint8Array {
  if (typeof x === 'number' || typeof x === 'bigint') {
    return int2ScriptSig(x as bigint);
  } else if (typeof x === 'boolean') {
    return bool2ScriptSig(x as boolean);
  } else if (typeof x === 'string') {
    return bytes2ScriptSig(x);
  }
  throw new Error(`unsupport PrimitiveTypes: ${x}`);
}

/**
 * @ignore
 * @param indexVal
 * @returns
 */
export function indexValueToBytes(indexVal: Int32): ByteString {
  assert(indexVal >= TX_IO_INDEX_VAL_MIN && indexVal <= TX_IO_INDEX_VAL_MAX);
  let indexBytes = intToByteString(indexVal);
  if (indexBytes == toByteString('')) {
    indexBytes = toByteString('00');
  }
  return indexBytes + toByteString('000000');
}

/**
 * @ignore
 * @param outpoint
 * @returns
 */
export function outpointToBytes(outpoint: Outpoint): ByteString {
  return outpoint.txHash + outpoint.outputIndex;
}

/**
 * @ignore
 * @param outputsByte
 * @returns
 */
export function deserializeOutputs(outputsByte: ByteString): { value: bigint; scriptHash: string, dataHash: string }[] {
  const reader = new BufferReader(tools.fromHex(outputsByte));
  const outputs = [];
  try {
    while (reader.offset < reader.buffer.length) {
      const value = reader.readInt64();
      const scriptHash = uint8ArrayToHex(reader.readSlice(32));
      const dataHash = uint8ArrayToHex(reader.readSlice(32));
      outputs.push({ value, scriptHash, dataHash });
    }
  } catch (_error) {
    throw new Error(`Invalid format of serialized outputs: ${outputsByte}`);
  }
  return outputs;
}
