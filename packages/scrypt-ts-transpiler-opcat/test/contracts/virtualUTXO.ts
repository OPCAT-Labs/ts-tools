import {
  TxUtils,
  toByteString,
  assert,
  method,
  SmartContract,
  Int32,
  ByteString,
  FixedArray,
  StructObject,
  StdUtils,
  slice,
} from '@opcat-labs/scrypt-ts-opcat';

export interface VirtualUTXOState extends StructObject {
  dummyStateProp: Int32;
}

export const LOGICAL_UTXO_SIZE = 3;

export class VirtualUTXO extends SmartContract<VirtualUTXOState> {
  constructor() {
    super(...arguments);
  }

  @method()
  public unlock(
    prevoutTxids: FixedArray<ByteString, typeof LOGICAL_UTXO_SIZE>,
    prevoutOutputIndexes: FixedArray<Int32, typeof LOGICAL_UTXO_SIZE>,
  ) {
    // verify prevoutTxids and prevoutOutputIndexes
    for (let i = 0; i < LOGICAL_UTXO_SIZE; i++) {
      const  prevout = slice(this.ctx.prevouts, BigInt(i) * 32n, (BigInt(i) + 1n) * 32n)
      assert(
        prevout ==
          prevoutTxids[i] + StdUtils.uint32ToByteString(prevoutOutputIndexes[i]),
        'prevout mismatch',
      );
    }
    for (let i = 0; i < 6; i++) {
      if (i >= LOGICAL_UTXO_SIZE) {
        const prevout = slice(this.ctx.prevouts, BigInt(i) * 32n, (BigInt(i) + 1n) * 32n)
        assert(prevout == toByteString(''), 'prevout is not empty');
      }
    }

    // The prevout of the current input which is being executed.
    const currentPrevout = slice(this.ctx.prevouts, this.ctx.inputIndex * 32n, (this.ctx.inputIndex + 1n) * 32n);

    for (let i = 0; i < LOGICAL_UTXO_SIZE; i++) {
      const prevout = prevoutTxids[i] + StdUtils.uint32ToByteString(prevoutOutputIndexes[i]);

      // Within the prevouts array, find the prevout for the currently executed input.
      if (prevout == currentPrevout) {
        const currentPrevoutTXID = prevoutTxids[i];
        const currentPrevoutOutputIndex = prevoutOutputIndexes[i];

        const isLastInput = BigInt(i) == BigInt(LOGICAL_UTXO_SIZE) - 1n;

        // Check the subsequent input is unlocking the subsequent output index from the same transaction.
        // If the last input is being executed, the subsequent input is the FIRST one. This ensures a circular
        // verification structure.
        const nextInputIndex = isLastInput ? 0n : BigInt(i) + 1n;
        const nextPrevoutTXID = prevoutTxids[Number(nextInputIndex)];
        const nextPrevoutOutputIndex = prevoutOutputIndexes[Number(nextInputIndex)];
        assert(currentPrevoutTXID == nextPrevoutTXID, 'next input TXID mismatch');
        assert(
          nextPrevoutOutputIndex == (isLastInput ? 0n : currentPrevoutOutputIndex + 1n),
          'next input not unlocking subsequent output idx',
        );
      }
    }

    // Propagate contract.
    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, VirtualUTXO.stateHash(this.state))
    outputs += this.buildChangeOutput();
    assert(this.checkOutputs(outputs), 'outputs mismatch');
  }
}
