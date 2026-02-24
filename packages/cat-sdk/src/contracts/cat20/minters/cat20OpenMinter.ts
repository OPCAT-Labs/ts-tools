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
  TxHashPreimageUtils,
  tags
} from '@opcat-labs/scrypt-ts-opcat'
import {
  CAT20State,
  CAT20OpenMinterState,
  CAT20_AMOUNT,
  OpenMinterCAT20Meta,
} from '../types.js'
import { OUTPUT_DATA_HASH_INDEX, OUTPUT_DATA_HASH_LEN } from '../../constants.js'
import { ConstantsLib } from '../../constants.js'
import { OwnerUtils } from '../../utils/ownerUtils.js'
import { CAT20StateLib } from '../cat20StateLib.js'
import { CAT20OpenMinterMetadata } from './cat20OpenMinterMetadata.js'
import { CatTags } from '../../catTags.js'
const MAX_NEXT_MINTERS = 2

/**
 * The CAT20 open minter contract
 * @category Contract
 * @category CAT20
 * @notice Premine tokens are controlled by preminer's signature
 * @notice Preminer can mint to any address during premine phase
 * @onchain
 */
@tags([CatTags.CAT20_MINTER_TAG])
export class CAT20OpenMinter extends SmartContract<CAT20OpenMinterState> {
  @prop()
  genesisOutpoint: ByteString

  // token max supply == this.maxCount * this.limit
  @prop()
  maxCount: bigint

  @prop()
  premineCount: bigint

  @prop()
  limit: CAT20_AMOUNT

  @prop()
  preminerAddr: ByteString

  constructor(
    genesisOutpoint: ByteString,
    maxCount: bigint,
    premineCount: bigint,
    limit: CAT20_AMOUNT,
    premineAddr: ByteString
  ) {
    super(...arguments)
    this.genesisOutpoint = genesisOutpoint
    this.maxCount = maxCount
    this.premineCount = premineCount
    this.limit = limit
    this.preminerAddr = premineAddr
    // C.3 Fix: Parameter validation
    assert(
      this.premineCount >= 0n,
      'premineCount must be non-negative'
    )
    assert(
      this.limit > 0n,
      'limit must be greater than 0'
    )
    assert(
      this.premineCount <= this.maxCount,
      'premineCount must not exceed maxCount'
    )
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
    // F10 Fix: Enforce minter must be at input index 0
    assert(this.ctx.inputIndex == 0n, 'minter must be at input index 0')

    // C.7 Fix: Ensure token output has non-zero satoshis
    assert(tokenSatoshis > 0n, 'tokenSatoshis must be greater than 0')

    // back to genesis
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)

    // split to multiple next openMinters
    let minterOutputs = toByteString('')
    let sumNextRemainingCount = 0n
    for (let i = 0; i < MAX_NEXT_MINTERS; i++) {
      const remainingCount = nextRemainingCounts[i]
      if (remainingCount > 0n) {
        // C.7 Fix: Ensure minter output has non-zero satoshis
        assert(minterSatoshis > 0n, 'minterSatoshis must be greater than 0 when creating minter output')
        sumNextRemainingCount += remainingCount
        minterOutputs += TxUtils.buildDataOutput(
          this.ctx.spentScriptHash,
          minterSatoshis,
          sha256(CAT20OpenMinter.serializeState({
            tokenScriptHash: this.state.tokenScriptHash,
            hasMintedBefore: true,
            remainingCount,
          }))
        )
      }
    }

    // next token output
    CAT20StateLib.checkState(tokenMint)
    const tokenStateHash = sha256(CAT20StateLib.serializeState(tokenMint))
    const tokenOutput = TxUtils.buildDataOutput(
      this.state.tokenScriptHash,
      tokenSatoshis,
      tokenStateHash
    )
    const premine = this.premineCount * this.limit
    if (!this.state.hasMintedBefore && premine > 0n) {
      // needs to premine
      assert(this.maxCount == this.state.remainingCount + this.premineCount, 'maxCount is not equal to remainingCount + premineCount')
      // preminer checksig
      OwnerUtils.checkUserOwner(preminerPubKey, this.preminerAddr)
      assert(this.checkSig(preminerSig, preminerPubKey), 'preminer sig is invalid')
      // premine dees not affect curState.remainingCount
      assert(sumNextRemainingCount == this.state.remainingCount, 'sumNextRemainingCount is not equal to remainingCount')
      assert(tokenMint.amount == premine, 'token amount is not equal to premine')
    } else {
      // general mint
      if (!this.state.hasMintedBefore) {
        // this is the first time mint
        assert(this.maxCount == this.state.remainingCount, 'maxCount is not equal to remainingCount')
        assert(this.premineCount == 0n, 'premineCount is not equal to 0')
      }
      assert(sumNextRemainingCount == this.state.remainingCount - 1n, 'sumNextRemainingCount is not equal to remainingCount - 1')
      assert(tokenMint.amount == this.limit, 'token amount is not equal to limit')
    }

    // change output
    const changeOutput = this.buildChangeOutput()

    // confine curTx outputs
    assert(this.checkOutputs(minterOutputs + tokenOutput + changeOutput), 'outputs are invalid')
  }
}
