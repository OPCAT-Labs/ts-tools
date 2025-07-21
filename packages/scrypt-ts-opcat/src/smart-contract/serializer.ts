import { assert, intToByteString, toByteString } from './fns/index.js';
import { Bool, ByteString, Int32, PrimitiveTypes } from './types/primitives.js';
import * as tools from 'uint8array-tools';
import { Script } from './types/script.js';
import { uint8ArrayToHex } from '../utils/common.js';
import { Outpoint } from './types/structs.js';
import { BufferReader } from '../psbt/bufferutils.js';
/**
 * @ignore
 * int to little-endian signed magnitude
 */
function int2hex(n: Int32): string {
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
 * @param b
 * @returns
 */
function bool2hex(b: Bool): string {
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
function bytes2hex(b: ByteString): string {
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
 * @param x
 * @returns
 */
export function serializeArgToHex(x: PrimitiveTypes): string {
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
