import { SmartContract, method, prop, assert, ByteString, toByteString, Sig, PubKey, BacktraceInfo, TxUtils, UInt64, len, SHA256_HASH_LEN, tags } from '@opcat-labs/scrypt-ts-opcat'

import { CAT20State, CAT20ClosedMinterState } from '../types.js'
import { OwnerUtils } from '../../utils/ownerUtils.js'
import { CAT20StateLib } from '../cat20StateLib.js'
import { CatTags } from '../../catTags.js'
/**
 * The CAT20 closed minter contract
 * @category Contract
 * @category CAT20
 * @onchain
 */
@tags([CatTags.CAT20_MINTER_TAG])
export class CAT20ClosedMinter extends SmartContract<CAT20ClosedMinterState> {
  @prop()
  issuerAddress: ByteString

  @prop()
  genesisOutpoint: ByteString

  constructor(ownerAddress: ByteString, genesisOutpoint: ByteString) {
    super(...arguments)
    this.issuerAddress = ownerAddress
    this.genesisOutpoint = genesisOutpoint
  }

  @method()
  public mint(
    // args to mint token
    tokenMint: CAT20State,
    issuerPubKey: PubKey,
    issuerSig: Sig,
    // output satoshis of curTx minter output
    // if the token is fixed supply, or the token is non-mintable anymore, then this value is 0
    minterSatoshis: UInt64,
    // output satoshis of curTx token output
    tokenSatoshis: UInt64,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    // F10 Fix: Enforce minter must be at input index 0
    assert(this.ctx.inputIndex == 0n, 'minter must be at input index 0')

    // C.7 Fix: Ensure token output has non-zero satoshis
    assert(tokenSatoshis > 0n, 'tokenSatoshis must be greater than 0')

    // back to genesis
    const minterScript = this.ctx.spentScriptHash;
    this.backtraceToOutpoint(
      backtraceInfo,
      this.genesisOutpoint
    )

    // check issuer
    OwnerUtils.checkUserOwner(issuerPubKey, this.issuerAddress)
    assert(this.checkSig(issuerSig, issuerPubKey))

    CAT20ClosedMinter.checkState(this.state);

    // build curTx outputs
    // next minter output
    let minterOutput = toByteString('')
    if (minterSatoshis > TxUtils.ZERO_SATS) {
      minterOutput = TxUtils.buildDataOutput(
        minterScript,
        minterSatoshis,
        this.ctx.spentDataHash
      )
    }
    // next token output
    CAT20StateLib.checkState(tokenMint)
    const tokenStateHash = CAT20StateLib.stateHash(tokenMint)
    const tokenOutput = TxUtils.buildDataOutput(
      this.state.tokenScriptHash,
      tokenSatoshis,
      tokenStateHash
    )

    // confine curTx outputs
    assert(this.checkOutputs(minterOutput + tokenOutput + this.buildChangeOutput()))
  }


  @method()
  static checkState(_state: CAT20ClosedMinterState): void {
    assert(len(_state.tokenScriptHash) == SHA256_HASH_LEN)
  }
}
