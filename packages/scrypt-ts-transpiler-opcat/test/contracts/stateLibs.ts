import { StructObject, StateLib, Int32, assert, method, Bool } from '@opcat-labs/scrypt-ts-opcat';

export interface DelegateeState extends StructObject {
  total: Int32;
}

export interface DelegatorState extends StructObject {
  delegated: Bool;
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
