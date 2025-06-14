import { SmartContract, method, assert, ByteString, prop } from '@scrypt-inc/scrypt-ts-btc';
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
