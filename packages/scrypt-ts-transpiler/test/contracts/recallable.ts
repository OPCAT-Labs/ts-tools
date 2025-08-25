import {
  assert,
  ByteString,
  Int32,
  method,
  prop,
  PubKey,
  sha256,
  Sig,
  SmartContract,
  StructObject,
  TxUtils,
} from '@opcat-labs/scrypt-ts';

/**
 * re-callable satoshis demo
 * users can transfer these satoshis as wish, and issuer can recall them back to himself at anytime
 */

export interface RecallableState extends StructObject {
  userPubKey: ByteString; // the first user is the issuer himself
}

export class Recallable extends SmartContract<RecallableState> {
  // the public key of issuer
  @prop()
  readonly issuerPubKey: PubKey;

  constructor(issuer: PubKey) {
    super(...arguments);
    this.issuerPubKey = issuer;
  }

  @method()
  public transfer(
    userSig: Sig, // the current user should provide his signature before transfer
    receiverPubKey: PubKey, // send to
    satoshisSent: bigint, // send amount
    satoshisTotal: Int32,
  ) {
    // total satoshis locked in this contract utxo
    assert(satoshisTotal == this.ctx.value, 'satoshisTotal check failed');

    // require the amount requested to be transferred is valid
    assert(
      satoshisSent > 0 && satoshisSent <= satoshisTotal,
      `invalid value of \`satoshisSent\`, should be greater than 0 and less than or equal to ${satoshisTotal}`,
    );

    // require the current user to provide signature before transfer
    assert(this.checkSig(userSig, PubKey(this.state.userPubKey)), "user's signature check failed");

    // temp record previous user
    const previousUserPubKey = this.state.userPubKey;

    // construct all the outputs of the method calling tx

    // the output send to `receiver`
    this.state.userPubKey = receiverPubKey;

    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, satoshisSent, Recallable.stateHash(this.state));


    // the change output back to previous `user`
    const satoshisLeft = satoshisTotal - satoshisSent;
    if (satoshisLeft > 0) {
      this.state.userPubKey = previousUserPubKey;

      outputs += TxUtils.buildDataOutput(this.ctx.spentScriptHash, satoshisLeft, Recallable.stateHash(this.state))
    }

    // the change output for paying the transaction fee
    outputs += this.buildChangeOutput();

    // require all of these outputs are actually in the unlocking transaction
    assert(this.checkOutputs(outputs), 'hashOutputs check failed');
  }

  @method()
  public recall(issuerSig: Sig) {
    // require the issuer to provide signature before recall
    assert(this.checkSig(issuerSig, this.issuerPubKey), "issuer's signature check failed");

    this.state.userPubKey = this.issuerPubKey;
    // the amount is satoshis locked in this UTXO

    let outputs = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value, Recallable.stateHash(this.state))

    outputs += this.buildChangeOutput();

    // require all of these outputs are actually in the unlocking transaction
    assert(this.checkOutputs(outputs), 'hashOutputs check failed');
  }
}
