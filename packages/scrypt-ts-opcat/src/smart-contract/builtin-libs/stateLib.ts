/* eslint-disable @typescript-eslint/no-explicit-any */
import { SmartContractLib } from '../smartContractLib.js';
import { ByteString, OpcatState } from '../types/primitives.js';
import { ABICoder } from '../abi.js';
import { deserializeState, serializeState } from '../stateSerializer.js';
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
  static serializeState<T extends OpcatState>(
    this: { new (...args: any[]): StateLib<T> },
    state: T,
  ): ByteString  {
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

  /**
   * Deserializes a state object from its ByteString representation.
   * 
   * @template T - Type of the state object extending OpcatState
   * @param this - Reference to the StateLib class constructor
   * @param serializedState - ByteString containing the serialized state data
   * @returns The deserialized state object of type T
   * @throws Error if artifact is not loaded, library is not found, or state type is undefined
   */
  static deserializeState<T extends OpcatState>(
    this: { new(...args: any[]): StateLib<T> },
    serializedState: ByteString,
  ): T {
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

    return deserializeState(artifact, libraryClazz.stateType, serializedState);
  }

  /**
   * Computes the SHA-256 hash of a serialized state object.
   * @template T - Type extending OpcatState
   * @param state - The state object to hash
   * @returns The hash as a ByteString
   */
  static stateHash<T extends OpcatState>(
    this: { new(...args: any[]): StateLib<T> },
    state: T,
  ): ByteString {
    return sha256((this as any).serializeState(state));
  }

  // keep this field to enable the typecheck for stateHash method in ts
  protected __state_lib_dummy_private_field__: ST
}
