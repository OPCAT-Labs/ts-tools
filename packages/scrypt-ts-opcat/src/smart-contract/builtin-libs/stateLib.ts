import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, OpcatState } from '../types/primitives.js';
import { ABICoder } from '../abi.js';
import { serializeState } from '../stateSerializer.js';
import { getUnRenamedSymbol } from '../abiutils.js';
import { sha256 } from '../fns/index.js';

/**
 * Library for computing the hash of a state.
 * @category Library
 * @onchain
 */
export class StateLib<ST extends OpcatState> extends SmartContractLib {
  /**
   * Calculate the hash of the state object
   * @param state the state object
   * @returns the hash byte string of the state object
   * @onchain
   * @category State
   */
  static serializeState<ST extends OpcatState>(
    this: { new (...args: unknown[]): StateLib<ST> },
    state: ST,
  ): ByteString {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const libraryClazz = this as any as typeof SmartContractLib;
    const artifact = libraryClazz.artifact;
    if (!artifact) {
      throw new Error(`Artifact is not loaded for the library: ${this.name}`);
    }

    const abiCoder = new ABICoder(artifact);
    const library = abiCoder.artifact.library.find(
      (lib) => getUnRenamedSymbol(lib.name) === getUnRenamedSymbol(this.name),
    );
    if (!library) {
      throw new Error(`Library ${this.name} is not found in the artifact`);
    }
    if (!library.stateType) {
      throw new Error(`State type is not defined for the library: ${this.name}`);
    }

    return serializeState(artifact, libraryClazz.stateType, state);
  }

  static stateHash<ST extends OpcatState>(
    this: { new (...args: unknown[]): StateLib<ST> },
    state: ST,
  ): ByteString {
    return sha256((this as any).serializeState(state));
  }

  // keep this method to enable the typecheck for stateHash method in ts
  private _id(_state: ST): ST {
    return _state;
  }
}
