import {
  ByteString,
  assert,
  SmartContract,
  TxUtils,
  hash256,
  int32ToByteString,
  method,
  prop,
} from '@opcat-labs/scrypt-ts-opcat';

//Read Medium article about this contract
//https://xiaohuiliu.medium.com/inter-contract-call-on-bitcoin-f51869c08be

export type Coeff = {
  a: bigint;
  b: bigint;
  c: bigint;
};

export class Callee extends SmartContract {
  @prop()
  static readonly N: bigint = 2n;

  @method()
  public solve(co: Coeff, x: bigint) {
    assert(co.a + x + x + co.b + x + co.c == 0n);

    const data: ByteString =
      int32ToByteString(co.a) + int32ToByteString(co.b) + int32ToByteString(co.c);

    const outputs: ByteString = TxUtils.buildOpReturnOutput(data);

    assert(hash256(outputs) == this.ctx.shaOutputs);
  }
}
