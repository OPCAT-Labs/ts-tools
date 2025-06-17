import { uint8ArrayToHex } from '../utils/common.js';
import { ABICoder } from './abi.js';
import { hash160, toByteString } from './fns/index.js';
import { OpcatState, ByteString } from './types/primitives.js';
import { Artifact } from './types/artifact.js';
import { MAX_FLAT_FIELDS_IN_STATE } from './consts.js';
import { getUnRenamedSymbol } from './abiutils.js';
import * as scriptNumber from '../utils/script_number.js';
import { VarWriter } from './builtin-libs/txUtils.js';

/**
 * @ignore
 */
export function stateSerialize(
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
    if (typeof field.value === 'number' || typeof field.value === 'bigint') {
      const val = uint8ArrayToHex(scriptNumber.encode(Number(field.value)));
      data += VarWriter.writeBytes(val)
      return hash160(val);
    }

    if (typeof field.value === 'boolean') {
      const val = field.value ? '01' : ''
      data += VarWriter.writeBytes(val)
      return hash160(val);
    }

    if (typeof field.value === 'string') {
      const val = field.value;
      data += VarWriter.writeBytes(val)
      return hash160(val);
    }

    throw new Error(`Unflattened struct field: ${field.type}`);
  });

  const dataHash = hash160(fieldHashes.join(''));

  data += dataHash;
  return data;
}
