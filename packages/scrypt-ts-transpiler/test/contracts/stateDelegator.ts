import { SmartContract, method, assert, ByteString, prop, slice, sha256 } from '@opcat-labs/scrypt-ts';
import { DelegatorState } from './stateLibs';

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
    const spentScriptHash = slice(this.ctx.spentScriptHashes, 32n*1n, 32n*2n);
    assert(spentScriptHash === sha256(this.delegateeScript));
  }
}
