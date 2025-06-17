import { SmartContract, method, assert, ByteString, prop } from '@opcat-labs/scrypt-ts-opcat';
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
    assert(this.ctx.spentScripts[1] === this.delegateeScript);
  }
}
