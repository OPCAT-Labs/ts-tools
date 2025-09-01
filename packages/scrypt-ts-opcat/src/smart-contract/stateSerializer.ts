import { ABICoder } from './abi.js';
import { assert, hash160, intToByteString, len, slice, toByteString, byteStringToInt } from './fns/index.js';
import { OpcatState, ByteString } from './types/primitives.js';
import { Artifact } from './types/artifact.js';
import { MAX_FLAT_FIELDS_IN_STATE } from './consts.js';
import { getUnRenamedSymbol } from './abiutils.js';
import { Argument } from './types/abi.js';

const FIELD_LEN_BYTES = 2n;


/**
 * Serializes contract state into a ByteString format.
 * @ignore
 * @param artifact - The contract artifact containing ABI definitions
 * @param stateType - The name of the state struct to serialize
 * @param state - The state object to be serialized
 * @returns ByteString representation of the serialized state
 * @throws Error if state struct is not found, has too many fields, or contains unflattened structs
 */
export function serializeState(
  artifact: Artifact,
  stateType: string,
  state: OpcatState,
): ByteString {
  const abiCoder = new ABICoder(artifact);

  const stateStruct = abiCoder.artifact.structs.find(
    (struct) => getUnRenamedSymbol(struct.name) === getUnRenamedSymbol(stateType),
  );
  if (!stateStruct) {
    throw new Error(
      `Struct ${stateType} is not defined in artifact of contract ${artifact.contract}!`,
    );
  }

  const fields = abiCoder.flattenStruct(state, stateType);

  if (fields.length > MAX_FLAT_FIELDS_IN_STATE) {
    // the hashes of the fields are connected on the stack, so the max length is 520 / 20 = 26.
    throw new Error(
      `Too many flattened fields in the state object ${stateType}, the max is ${MAX_FLAT_FIELDS_IN_STATE}`,
    );
  }

  let data = toByteString('');

  const fieldHashes = fields.map((field) => {
    let val: ByteString;
    switch (typeof field.value) {
      case 'number':
      case 'bigint':
        val = intToByteString(field.value);
        break;
      case 'boolean':
        val = field.value ? '01' : '';
        break;
      case 'string':
        val = field.value;
        break;
      default:
        throw new Error(`Unflattened struct field: ${field.type}`);
    }

    const MAX_FIELD_LENGTH = 0x7fff;  // INT16_MAX
    assert(len(val) <= MAX_FIELD_LENGTH, `field ${field.name} value is too large`)
    data += (intToByteString(len(val), FIELD_LEN_BYTES) + val)
    return hash160(val);
  });

  const checkHash = hash160(fieldHashes.join(''));

  data += checkHash;
  return data;
}


/**
 * Deserializes a contract state from a byte string into a structured object.
 * @ignore
 * @template T - The type of the deserialized state object
 * @param artifact - The contract artifact containing ABI definitions
 * @param stateType - The name of the state struct type to deserialize
 * @param serializedState - The byte string containing serialized state data
 * @returns The deserialized state object of type T
 * @throws Error if the specified state struct is not found in the artifact
 * @throws AssertionError if the state hash check fails or data is incomplete
 */
export function deserializeState<T>(
  artifact: Artifact,
  stateType: string,
  serializedState: ByteString,
): T {
  const abiCoder = new ABICoder(artifact);

  const stateStruct = abiCoder.artifact.structs.find(
    (struct) => getUnRenamedSymbol(struct.name) === getUnRenamedSymbol(stateType),
  );
  if (!stateStruct) {
    throw new Error(
      `Struct ${stateType} is not defined in artifact of contract ${artifact.contract}!`,
    );
  }

  const fields = abiCoder.flattenStruct(undefined, stateType, true);
  const state = {} as T;

  const setFieldValue = (field: Argument, valueByteString: string) => {
    const fieldNames = field.name.split('.');
    fieldNames.shift()  // remove the first element, `flattened_struct`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any;
    switch (field.type) {
      case 'number':
        val = Number(byteStringToInt(valueByteString));
        break;
      case 'bigint':
      case 'int':
        val = byteStringToInt(valueByteString);
        break;
      case 'boolean':
      case 'bool':
        val = valueByteString === '01';
        break;
      default:
        val = valueByteString;
        break;
    }
    // todo: test multi-dimensional array

    let curObj = state;
    fieldNames.forEach((fieldName, index) => {
      const lBracketIndex = fieldName.indexOf('[');
      const fieldNameHasArray = lBracketIndex !== -1;
      const isLastField = index === fieldNames.length - 1;


      if (fieldNameHasArray) {
        const arrayIndexRegex = /\[\d+\]/g;
        const arrayIndexes = fieldName.match(arrayIndexRegex).map(str => str.slice(1, -1));
        const fieldName0 = fieldName.slice(0, lBracketIndex);

        curObj[fieldName0] = curObj[fieldName0] || [];
        curObj = curObj[fieldName0];

        arrayIndexes.forEach((arrayIndex, index2) => {
          const isLastArrayIndex = index2 === arrayIndexes.length - 1;
          if (isLastArrayIndex) {
            if (isLastField) {
              curObj[arrayIndex] = val;
            } else {
              curObj[arrayIndex] = curObj[arrayIndex] || {}
            }
          } else {
            curObj[arrayIndex] = curObj[arrayIndex] || [];
          }
          curObj = curObj[arrayIndex];
        })

      } else {
        if (isLastField) {
          curObj[fieldName] = val;
        } else {
          curObj[fieldName] = curObj[fieldName] || {};
        }
        curObj = curObj[fieldName];
      }
    })
  }


  let readIndex = 0n;
  let fieldHashes = toByteString('');
  for (const field of fields) {
    const valLen = byteStringToInt(slice(serializedState, readIndex, readIndex + FIELD_LEN_BYTES))
    const value = slice(serializedState, readIndex + FIELD_LEN_BYTES, readIndex + FIELD_LEN_BYTES + valLen);

    fieldHashes += hash160(value);

    readIndex = readIndex + FIELD_LEN_BYTES + valLen;
    setFieldValue(field, value);
  }

  const checkHash = hash160(fieldHashes);
  const checkHashFromState = slice(serializedState, readIndex, readIndex + 20n);
  assert(checkHash === checkHashFromState, 'check hash mismatch');
  assert(readIndex + 20n === len(serializedState), 'serialized state is not complete');

  return state;
}

export function createEmptyState<T>(
  artifact: Artifact,
  stateType: string,
): T {
  const abiCoder = new ABICoder(artifact);

  const stateStruct = abiCoder.artifact.structs.find(
    (struct) => getUnRenamedSymbol(struct.name) === getUnRenamedSymbol(stateType),
  );
  if (!stateStruct) {
    throw new Error(
      `Struct ${stateType} is not defined in artifact of contract ${artifact.contract}!`,
    );
  }

  const fields = abiCoder.flattenStruct({}, stateType, true);
  const serializedState = new Array(fields.length).fill(intToByteString(0n, FIELD_LEN_BYTES)).join('');

  return deserializeState<T>(artifact, stateType, serializedState);
}