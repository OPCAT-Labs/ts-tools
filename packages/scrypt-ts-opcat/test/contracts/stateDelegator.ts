import { SmartContract, method, assert, ByteString, prop, sha256, slice} from '../../src/index.js';
import { DelegatorState } from './stateLibs.js';

export class StateDelegator extends SmartContract<DelegatorState> {
  @prop()
  delegateeScript: ByteString;

  constructor(delegateeScript: ByteString) {
    super(delegateeScript);
    this.delegateeScript = delegateeScript;
  }

  @method()
  public unlock() {
    // make sure the second input is a delegatee input
    const delegatee_input_index = 1n;
    const spentScriptHash = slice(this.ctx.spentScriptHashes, delegatee_input_index * 32n, (delegatee_input_index +  1n) * 32n);
    assert(spentScriptHash === sha256(this.delegateeScript));
  }
}
