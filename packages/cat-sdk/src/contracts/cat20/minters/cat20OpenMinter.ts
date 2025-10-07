import {
  method,
  SmartContract,
  assert,
  prop,
  ByteString,
  FixedArray,
  toByteString,
  PubKey,
  Sig,
  slice,
  TxUtils,
  UInt64,
  sha256,
  BacktraceInfo,
  TxHashPreimageUtils
} from '@opcat-labs/scrypt-ts-opcat'
import {
  CAT20State,
  CAT20OpenMinterState,
  CAT20_AMOUNT,
  OpenMinterCAT20Meta,
} from '../types'
import { OUTPUT_DATA_HASH_INDEX, OUTPUT_DATA_HASH_LEN } from '../../constants'
import { ConstantsLib } from '../../constants'
import { OwnerUtils } from '../../utils/ownerUtils'
import { CAT20StateLib } from '../cat20StateLib'
import { CAT20OpenMinterMetadata } from './cat20OpenMinterMetadata'

const MAX_NEXT_MINTERS = 2

export class CAT20OpenMinter extends SmartContract<CAT20OpenMinterState> {
  @prop()
  genesisOutpoint: ByteString

  // token max supply == this.maxCount * this.limit
  @prop()
  maxCount: bigint

  // this.premine == this.preminerCount * this.limit
  @prop()
  premine: CAT20_AMOUNT

  @prop()
  premineCount: bigint

  @prop()
  limit: CAT20_AMOUNT

  @prop()
  preminerAddr: ByteString

  constructor(
    genesisOutpoint: ByteString,
    maxCount: bigint,
    premine: CAT20_AMOUNT,
    premineCount: bigint,
    limit: CAT20_AMOUNT,
    premineAddr: ByteString
  ) {
    super(...arguments)
    this.genesisOutpoint = genesisOutpoint
    this.maxCount = maxCount
    // this assumes this.premineCount * this.limit == this.premine,
    // which can be trivially validated by anyone after the token is deployed
    this.premine = premine
    this.premineCount = premineCount
    this.limit = limit
    this.preminerAddr = premineAddr
  }

  @method()
  public mint(
    // args to mint token
    tokenMint: CAT20State,
    nextRemainingCounts: FixedArray<bigint, typeof MAX_NEXT_MINTERS>,
    // premine related args
    preminerPubKey: PubKey,
    preminerSig: Sig,
    // output satoshis of curTx minter output
    minterSatoshis: UInt64,
    // output satoshis of curTx token output
    tokenSatoshis: UInt64,
    // backtrace
    backtraceInfo: BacktraceInfo,
  ) {
    // back to genesis
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)

    // split to multiple next openMinters
    let minterOutputs = toByteString('')
    let sumNextRemainingCount = 0n
    for (let i = 0; i < MAX_NEXT_MINTERS; i++) {
      const remainingCount = nextRemainingCounts[i]
      if (remainingCount > 0n) {
        sumNextRemainingCount += remainingCount
        minterOutputs += TxUtils.buildDataOutput(
          this.ctx.spentScriptHash,
          minterSatoshis,
          sha256(CAT20OpenMinter.serializeState({
            tag: ConstantsLib.OPCAT_CAT20_MINTER_TAG,
            tokenScriptHash: this.state.tokenScriptHash,
            hasMintedBefore: true,
            remainingCount,
          }))
        )
      }
    }

    // next token output
    const tokenStateHash = sha256(CAT20StateLib.serializeState(tokenMint))
    const tokenOutput = TxUtils.buildDataOutput(
      this.state.tokenScriptHash,
      tokenSatoshis,
      tokenStateHash
    )
    if (!this.state.hasMintedBefore && this.premine > 0n) {
      // needs to premine
      assert(this.maxCount == this.state.remainingCount + this.premineCount)
      // preminer checksig
      OwnerUtils.checkUserOwner(preminerPubKey, this.preminerAddr)
      assert(this.checkSig(preminerSig, preminerPubKey))
      // premine dees not affect curState.remainingCount
      assert(sumNextRemainingCount == this.state.remainingCount)
      assert(tokenMint.amount == this.premine)
    } else {
      // general mint
      if (!this.state.hasMintedBefore) {
        // this is the first time mint
        assert(this.maxCount == this.state.remainingCount)
        assert(this.premineCount == 0n)
        assert(this.premine == 0n)
      }
      assert(sumNextRemainingCount == this.state.remainingCount - 1n)
      assert(tokenMint.amount == this.limit)
    }

    // change output
    const changeOutput = this.buildChangeOutput()

    // confine curTx outputs
    assert(this.checkOutputs(minterOutputs + tokenOutput + changeOutput))
  }

  public checkProps() {
    //
    assert(
      this.premineCount * this.limit == this.premine,
      'premineCount needs to be multiplied by limit to equal premine.'
    )
  }
}
