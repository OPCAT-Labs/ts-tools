import { KeyValue, Psbt, PsbtInput } from 'bip174';
import * as tools from 'uint8array-tools';
import * as varuint from 'varuint-bitcoin';

// compact sized key, 0xfe + 4 bytes
// 4 bytes = 'cat'(tag) + '01'(version)
export const OPCAT_KEY = parseInt('0xfe' + Buffer.from('cat').toString('hex') + '01', 16);
export const OPCAT_KEY_BUF = Buffer.from('fe' + Buffer.from('cat').toString('hex') + '01', 'hex');

export interface OpcatUtxo {
  script: Uint8Array;
  data: Uint8Array;
  value: bigint;
}

export function decode(keyVal: KeyValue): OpcatUtxo {
  if (!OPCAT_KEY_BUF.equals(Buffer.from(keyVal.key))) {
    throw new Error(
      'Decode Error: could not decode opcatUtxo with key 0x' +
        tools.toHex(keyVal.key),
    );
  }
  let offset = 0;
  const value = tools.readInt64(keyVal.value, offset, 'LE');
  offset += 8;
  const { numberValue: scriptLen, bytes: scriptLenBytes } = varuint.decode(
    keyVal.value,
    offset,
  );
  if (scriptLen == null) throw new Error('Decode Error: scriptLen is null');
  offset += scriptLenBytes;
  const script = keyVal.value.slice(offset, offset + scriptLen);
  offset += scriptLen;
  const { numberValue: dataLen, bytes: dataLenBytes } = varuint.decode(
    keyVal.value,
    offset,
  );
  if (dataLen == null) throw new Error('Decode Error: dataLen is null');
  offset += dataLenBytes;
  const data = keyVal.value.slice(offset, offset + dataLen);
  offset += dataLen;
  return {
    script,
    data,
    value,
  };
}

export function encode(data: OpcatUtxo): KeyValue {
  const { script, data: opcatData, value } = data;
  const scriptLen = script.length;
  const dataLen = opcatData.length;
  const scriptLenVar = varuint.encodingLength(scriptLen);
  const dataLenVar = varuint.encodingLength(dataLen);
  const totalLen = 8 + scriptLenVar + scriptLen + dataLenVar + dataLen;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  tools.writeInt64(result, offset, BigInt(value), 'LE');
  offset += 8;
  varuint.encode(scriptLen, result, offset);
  offset += scriptLenVar;
  result.set(script, offset);
  offset += scriptLen;
  varuint.encode(dataLen, result, offset);
  offset += dataLenVar;
  result.set(opcatData, offset);
  return {
    key: new Uint8Array(OPCAT_KEY_BUF),
    value: result,
  };
}

export function parseInputOutputFromPsbt(input: PsbtInput): OpcatUtxo {
    const findKV = (input.unknownKeyVals || []).find(kv => OPCAT_KEY_BUF.equals(Buffer.from(kv.key)));
    if (!findKV) {
        throw new Error('Decode Error: could not find opcatUtxo with key 0x' +
            tools.toHex(OPCAT_KEY_BUF));
    }
    return decode(findKV);
}