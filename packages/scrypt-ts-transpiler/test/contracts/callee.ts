import {
  ByteString,
  assert,
  SmartContract,
  TxUtils,
  hash256,
  intToByteString,
  method,
  prop,
} from '@opcat-labs/scrypt-ts';

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
      intToByteString(co.a) + intToByteString(co.b) + intToByteString(co.c);

    const outputs: ByteString = TxUtils.buildOpReturnOutput(data);

    assert(hash256(outputs) == this.ctx.hashOutputs);
  }
}
