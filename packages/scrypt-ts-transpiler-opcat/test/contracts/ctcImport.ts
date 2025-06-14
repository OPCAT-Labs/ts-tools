import {
  ByteString,
  FixedArray,
  SmartContract,
  assert,
  fill,
  method,
  toByteString,
} from '@scrypt-inc/scrypt-ts-btc';
import {
  FFF,
  MAX_TOKEN_OUTPUT,
  MAX_TOKEN_OUTPUT1,
  MAX_TOKEN_OUTPUT2,
  NEG,
  MAX_TOKEN_OUTPUT3 as O3,
} from './ctcImportDefined';

const M_OUTPUT = MAX_TOKEN_OUTPUT2;

export class CtcImport extends SmartContract {
  @method()
  test(a: number, b: FixedArray<ByteString, typeof a>): boolean {
    return true;
  }

  @method()
  public unlock() {
    this.test(1, fill(toByteString(''), 1));

    assert(NEG == -1n);

    let sum = 0n;
    for (let i = 0; i < MAX_TOKEN_OUTPUT; i++) {
      sum += BigInt(i);
    }

    for (let i = 0; i < MAX_TOKEN_OUTPUT1; i++) {
      sum += BigInt(i);
    }
    for (let i = 0; i < MAX_TOKEN_OUTPUT2; i++) {
      sum += BigInt(i);
    }
    for (let i = 0; i < M_OUTPUT; i++) {
      sum += BigInt(i);
    }
    for (let i = 0; i < O3; i++) {
      sum += BigInt(i);
    }

    const a: FFF = {
      aa: toByteString(''),
      bb: 3n,
    };

    const arr: FixedArray<ByteString, typeof MAX_TOKEN_OUTPUT> = fill(
      toByteString(''),
      MAX_TOKEN_OUTPUT,
    );

    // This is not working since ts would not compile it
    // const arr1: FixedArray<ByteString, typeof MAX_TOKEN_OUTPUT> = fill(toByteString(''), MAX_TOKEN_OUTPUT);

    // This is not working since ts cannot resolve `typeof MAX_TOKEN_OUTPUT2` to a certain number
    // const arr2: FixedArray<ByteString, typeof MAX_TOKEN_OUTPUT2> = fill(toByteString(''), MAX_TOKEN_OUTPUT2);

    // This is not working since ts cannot resolve `typeof O3` to a certain number
    // const arr3: FixedArray<ByteString, typeof O3> = fill(toByteString(''), O3);

    // If a ctc is imported from a npm package, it works only if it's a number literal, but not for a ctc expression.
    // For example:
    // it works fine if `MAX_TOKEN_OUTPUT` is imported from another npm package. (i.e. MAX_TOKEN_OUTPUT = 5)
    // but it will NOT work if `MAX_TOKEN_OUTPUT2` is imported from another npm package. (i.e. MAX_TOKEN_OUTPUT2 = 2 + 2)

    assert(sum == 10n);
  }
}
