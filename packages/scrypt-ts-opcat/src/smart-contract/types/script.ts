import { script } from '@scrypt-inc/bitcoinjs-lib';
import { hexToUint8Array, uint8ArrayToHex } from '../../utils/common.js';

/**
 * A bitcoin transaction script. Each transaction's inputs and outputs
 * has a script that is evaluated to validate it's spending.
 *
 * See https://en.bitcoin.it/wiki/Script
 *
 * @constructor
 * @param {Uint8Array} from data to populate script
 */
export class Script extends Uint8Array {
  constructor(rawBytes: Uint8Array) {
    super(rawBytes);
  }
  /**
   * Create a script object from an assembly string
   * @param asm the assembly string
   * @returns the script object
   */
  static fromASM(asm: string): Script {
    return new Script(script.fromASM(asm));
  }

  /**
   * Convert the script to an assembly string
   */
  toASM(): string {
    return script.toASM(this);
  }

  /**
   * Create a script object from a hex string
   * @param hex the hex string
   * @returns the script object
   */
  static fromHex(hex: string): Script {
    return new Script(hexToUint8Array(hex));
  }

  /**
   * Convert the script to a hex string
   */
  toHex(): string {
    return uint8ArrayToHex(this);
  }

  /**
   * Equality check
   * @param other the other script
   * @returns true if the scripts are equal
   */
  equals(other: Script): boolean {
    return this.toHex() === other.toHex();
  }
}
