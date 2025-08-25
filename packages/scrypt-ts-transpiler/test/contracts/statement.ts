import {
  method,
  prop,
  SmartContract,
  assert,
  toByteString,
  ByteString,
} from '@opcat-labs/scrypt-ts';

export class Statement extends SmartContract {
  @prop()
  x: bigint;

  constructor(x: bigint) {
    super(x);
    this.x = x;
  }

  @method()
  public unlock(z: bigint) {
    //ExprStmt
    true && 1n > z;
    false;

    // Declare

    let a: bigint = 3n;
    let bb: ByteString = toByteString('aa0a');
    let c: boolean = false;

    const e: bigint = 33n;
    const f: ByteString = toByteString('aa0a0a');
    const g: boolean = true;

    //TODO: New

    //Assign
    a = 4n;
    bb = toByteString('9933');
    c = true;

    // if

    if (a == 0n) {
      // exit(false);
    }

    if (a == 0n) {
      a = 1n;
    } else if (a == 1n) {
      a = 3n;
    } else {
      a = 4n;
    }

    //Block

    {
      a = 3n;
      if (a == 0n) {
        if (a == 0n) {
          // exit(false);
        }
      } else if (a == 1n) {
        a = 3n;
      } else {
        a = 4n;
      }
    }

    //loop
    const N = 5;

    for (let i = 0; i < N; i++) {
      a++;
    }

    const G = 15n;

    for (let k = 0n; k < G; k++) {
      a++;
    }

    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < N; k++) {
        a += BigInt(i + k);
      }
    }

    for (let i = 0; i < 5; i++) {
      if (a > 1) {
        a++;
      }
    }

    if (a > 1n) {
      for (let i = 0; i < 5; i++) {
        a++;
      }
    }

    //Require
    assert(z == 1n);
  }
}
