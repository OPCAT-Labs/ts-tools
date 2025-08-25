import { getUnRenamedSymbol } from './abiutils.js';
import { Artifact } from './types/artifact.js';
import { SupportedParamType } from './types/primitives.js';

/**
 * The contract library class. To write a contract library, extend this class as such:
 * @example
 *  ```ts
 * class YourSmartContractLib extends SmartContractLib {
 *   // your library functions code here
 * }
 * ```
 * @category SmartContract
 */
export class SmartContractLib {
  public static artifact: Artifact;
  static stateType?: string;

  static loadArtifact(artifact: Artifact) {
    const library = artifact.library.find(
      (lib) => getUnRenamedSymbol(lib.name) === getUnRenamedSymbol(this.name),
    );
    if (!library) {
      throw new Error(`Library ${this.name} is not found in the artifact`);
    }
    this.artifact = artifact;
    this.stateType = library.stateType;
    return this;
  }

  args = [];
  constructor(...args: SupportedParamType[]) {
    this.args = args;
  }
  /**
   *
   * @ignore
   */
  getArgs(): SupportedParamType[] {
    return (this.args || []).map((arg) => {
      if (arg instanceof SmartContractLib) {
        return arg.getArgs();
      }
      return arg;
    });
  }

  /**
   * @ignore
   * Checks if the current instance is a SmartContractLib.
   * @returns {boolean} Always returns true since this is a SmartContractLib class.
   */
  isSmartContractLib() {
    return true
  }
}
