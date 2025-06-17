import { method, SmartContract, assert } from '@opcat-labs/scrypt-ts-opcat';

export class EndingAssert extends SmartContract {
  @method()
  public unlock(z: bigint) {
    if (z > 0n) {
      assert(true);
    } else if (z == 0n) {
      assert(true);
    } else {
      assert(false, 'should not reach here');
    }
  }

  @method()
  public unlock0(z: bigint) {
    if (z > 0n) {
      assert(true);
    } else {
      assert(false);
    }
  }

  @method()
  public unlock1(z: bigint) {
    for (let i = 0; i < 3; i++) {
      assert(z >= i, 'invalid z');
    }
  }

  @method()
  public unlock2(z: bigint) {
    for (let i = 0; i < 3; i++) {
      if (z > 0n) {
        assert(true);
      } else if (z == 0n) {
        assert(true);
      } else {
        assert(true);
      }
    }
  }

  @method()
  public unlock3(z: bigint) {
    if (z > 0n) {
      assert(true);
      if (z > 0n) {
        assert(true);
      } else {
        assert(false);
      }
    } else {
      if (z > 0n) {
        assert(true);
      } else {
        assert(false);
      }
    }
  }

  @method()
  public unlock4(z: bigint) {
    if (z > 0n) {
      for (let i = 0; i < 3; i++) {
        assert(z >= i);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        assert(z < i);
      }
    }
  }
}
