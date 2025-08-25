import * as opcat from '@opcat-labs/opcat'
/**
 * A bitcoin transaction script. Each transaction's inputs and outputs
 * has a script that is evaluated to validate it's spending.
 *
 * See https://en.bitcoin.it/wiki/Script
 *
 * @constructor
 * @param {Uint8Array} from data to populate script
 */
export class Script extends opcat.Script {
  constructor(rawBytes: Uint8Array) {
    super(Buffer.from(rawBytes));
  }
}
