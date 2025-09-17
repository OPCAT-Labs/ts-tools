import { ABICoder } from "../../abi.js";
import { getUnRenamedSymbol } from "../../abiutils.js";
import { byteStringToInt, len, toByteString, slice, assert, intToByteString } from "../../fns/index.js";
import { createEmptyState, deserializeState, serializeState } from "../../stateSerializer.js";
import { Artifact } from "../../types/artifact.js";
import { ByteString, PRIMITIVE_TYPES, StructObject, SupportedParamType } from "../../types/primitives.js";

export function serializeKey(key: any): ByteString {
  const bytes = serializeSingleField(key);
  return intToByteString(len(bytes), 2n) + bytes;
}
export function deserializeKey(bytes: ByteString, artifact: Artifact, keyType: string) {
  return deserializeSingleField(bytes, keyType);
}

export function serializeValue(
    artifact: Artifact,
    valueType: string,
    value: SupportedParamType,
) {
  if (typeof value !== 'object') {
    const bytes = serializeSingleField(value);
    return intToByteString(len(bytes), 2n) + bytes;
  }
  return serializeState(artifact, valueType, value as StructObject, false);
}

export function deserializeValue(bytes: ByteString, artifact: Artifact, valueType: string) {
  if (PRIMITIVE_TYPES.includes(valueType)) {
    return deserializeSingleField(bytes, valueType);
  }
  return deserializeState(artifact, valueType, bytes, false);
}

export function serializeSingleField(val: any): ByteString {
  switch (typeof val) {
    case 'number':
    case 'bigint':
        return intToByteString(BigInt(val));
    case 'boolean':
        return val ? '01' : '';
    case 'string':
        return toByteString(val);
    default:
        throw new Error(`Unsupported key type: ${typeof val}`);
  }
}
export function deserializeSingleField(bytes: ByteString, fieldType: string) {
  const l = byteStringToInt(slice(bytes, 0n, 2n));
  const value = slice(bytes, 2n);
  assert(len(value) === l, 'value length mismatch');
  assert(PRIMITIVE_TYPES.includes(fieldType), 'field type is not a primitive type');
  switch (fieldType) {
    case 'int':
    case 'PrivKey':
      return byteStringToInt(value);
    case 'bool':
      return value === '01';
    default:
      return value;
  }
}

export function createEmptyValue<T>(
    artifact: Artifact,
    stateType: string
): T {
  const abiCoder = new ABICoder(artifact);

  const stateStruct = abiCoder.artifact.structs.find(
    (struct) => getUnRenamedSymbol(struct.name) === getUnRenamedSymbol(stateType),
  );
  if (stateStruct) {
    return createEmptyState(artifact, stateType, false)
  }
  switch(stateType) {
    case 'bigint':
    case 'int':
      return 0n as T;
    case 'boolean':
      return false as T;
    case 'bytes':
      return '' as T;
    default:
      throw new Error(`Unsupported state type: ${stateType}`)
  }
}