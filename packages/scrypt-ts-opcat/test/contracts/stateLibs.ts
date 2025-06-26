import { OpcatState, StateLib, Int32, assert, method } from '@opcat-labs/scrypt-ts-opcat';

export interface DelegateeState extends OpcatState {
  total: Int32;
}

export interface DelegatorState extends OpcatState {
  delegated: boolean;
}

export class DelegatorStateLib extends StateLib<DelegatorState> {
  @method()
  static checkState(s: DelegatorState): void {
    assert(s.delegated, 'Invalid delegated');
  }
}

export class DelegateeStateLib extends StateLib<DelegateeState> {
  @method()
  static checkState(s: DelegateeState): void {
    assert(s.total >= 0, 'Invalid total');
  }
}
