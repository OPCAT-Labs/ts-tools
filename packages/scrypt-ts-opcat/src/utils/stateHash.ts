import { scriptNumber } from '@scrypt-inc/bitcoinjs-lib';
import { uint8ArrayToHex } from './common.js';
import { ABICoder } from '../smart-contract/abi.js';
import { hash160 } from '../smart-contract/fns/index.js';
import { Ripemd160, OpcatState } from '../smart-contract/types/primitives.js';
import { Artifact } from '../smart-contract/types/artifact.js';
import { MAX_FLAT_FIELDS_IN_STATE } from '../smart-contract/consts.js';
import { getUnRenamedSymbol } from '../smart-contract/abiutils.js';

/**
 * @ignore
 */
export function calculateStateHash(
  artifact: Artifact,
  stateType: string,
  state: OpcatState,
): Ripemd160 {
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

  const fieldHashes = fields.map((field) => {
    if (typeof field.value === 'number' || typeof field.value === 'bigint') {
      return hash160(uint8ArrayToHex(scriptNumber.encode(Number(field.value))));
    }

    if (typeof field.value === 'boolean') {
      return hash160(field.value ? '01' : '');
    }

    if (typeof field.value === 'string') {
      return hash160(field.value);
    }

    throw new Error(`Unflattened struct field: ${field.type}`);
  });

  return hash160(fieldHashes.join(''));
}
