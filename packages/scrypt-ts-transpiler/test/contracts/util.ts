import {
  assert,
  ByteString,
  method,
  PubKeyHash,
  SHPreimage,
  SmartContract,
  toByteString,
  TxUtils,
} from '@opcat-labs/scrypt-ts';

export class Util extends SmartContract {
  @method()
  static add(x: bigint, y: bigint): bigint {
    return x + y;
  }

  @method()
  public unlock(x: bigint, txPreimage: SHPreimage) {
    let output: ByteString = TxUtils.buildOutput(
      toByteString('000100'),
      1n,
    );
    assert(output == toByteString('153400000000000003000100'));

    output = TxUtils.buildOpReturnOutput(toByteString('ef0a0a0a'));
    assert(output == toByteString('006a04ef0a0a0a'));

    output = TxUtils.buildP2PKHScript(
      PubKeyHash(toByteString('6791d7f19d3cda962e5b375a3f98f79a1971b7e1')),
    );
    assert(output == toByteString('76a9146791d7f19d3cda962e5b375a3f98f79a1971b7e188ac'));

    assert(
      txPreimage.hashOutputs ==
        toByteString('9f778ea594cfb552093773d85bad30c411ee47c5b5276da334da75f08152b093'),
    );

    assert(txPreimage.nVersion == toByteString('01000000'));

    assert(
      txPreimage.hashPrevouts ==
        toByteString('9ceca721285f50c306c6c1dfe65eaa3d6d13e4231facdf22f15528f086b0037e'),
    );

    assert(
      txPreimage.hashSequences ==
        toByteString('3bb13029ce7b1f559ef5e747fcac439f1455a2ec7c5f09b72290795e70665044'),
    );

    assert(txPreimage.spentScriptHash == toByteString('d830ec2a95365558adc015467958c2fc0e0a9804'));

    assert(txPreimage.nLockTime == 0n);

    assert(x > 0);
  }
}
