import {
  ByteString,
  SmartContract,
  prop,
  method,
  assert,
  BacktraceInfo,
  SpentScriptHashes,
  tags,
  ContextUtils,
  byteStringToInt,
  FixedArray,
  Sha256,
  toByteString,
  slice,
  SpentDataHashes
} from '@opcat-labs/scrypt-ts-opcat'
import { OwnerUtils } from '../utils/ownerUtils'
import { CAT20State, CAT20GuardConstState } from './types'
import {
  CAT20ContractUnlockArgs,
} from '../types'
import { GUARD_VARIANTS_COUNT } from '../constants'
import { CAT20GuardStateLib } from './cat20GuardStateLib'
import { CatTags } from '../catTags'

/**
 * The CAT20 contract
 * @category Contract
 * @category CAT20
 * @onchain
 */
@tags([CatTags.CAT20_TAG])
export class CAT20 extends SmartContract<CAT20State> {
  @prop()
  minterScriptHash: ByteString

  @prop()
  guardVariantScriptHashes: FixedArray<Sha256, typeof GUARD_VARIANTS_COUNT>;

  @prop()
  hasAdmin: boolean

  @prop()
  adminScriptHash: ByteString

  constructor(
    minterScriptHash: ByteString,
    guardVariantScriptHashes: FixedArray<Sha256, typeof GUARD_VARIANTS_COUNT>,
    hasAdmin: boolean,
    adminScriptHash: ByteString
  ) {
    super(...arguments)
    this.minterScriptHash = minterScriptHash
    this.guardVariantScriptHashes = guardVariantScriptHashes
    this.hasAdmin = hasAdmin
    this.adminScriptHash = adminScriptHash
  }

  @method()
  public unlock(
    unlockArgs: CAT20ContractUnlockArgs,
    // guard
    guardState: CAT20GuardConstState,
    guardInputIndex: bigint,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    this.backtraceToScript(backtraceInfo, this.minterScriptHash)

    // make sure tx inputs contain a valid guard
    this.checkGuard(
      guardState,
      this.ctx.spentScriptHash,
      this.ctx.inputIndex,
      guardInputIndex,
      this.ctx.spentScriptHashes,
      this.ctx.spentDataHashes
    )

    assert(
      unlockArgs.spendType >= 0n && unlockArgs.spendType <= 2n,
      'invalid spendType'
    )

    let spentScriptHash = toByteString('')
    //
    if (unlockArgs.spendScriptInputIndex >= 0n) {
      // Check upper bound to prevent out-of-bounds access
      assert(
        unlockArgs.spendScriptInputIndex < this.ctx.inputCount,
        'script index out of bounds'
      )
      spentScriptHash = ContextUtils.getSpentScriptHash(
        this.ctx.spentScriptHashes,
        unlockArgs.spendScriptInputIndex
      )
    }

    if (unlockArgs.spendType == 0n) {
      // user spend
      // unlock token owned by user key
      OwnerUtils.checkUserOwner(unlockArgs.userPubKey, this.state.ownerAddr)
      assert(this.checkSig(unlockArgs.userSig, unlockArgs.userPubKey))
    } else if (unlockArgs.spendType == 1n) {
      // contract spend
      // unlock token owned by contract script
      assert(this.state.ownerAddr == spentScriptHash)
    } else {
      // admin spend
      assert(this.hasAdmin, 'admin spend not allowed')
      assert(spentScriptHash == this.adminScriptHash, 'invalid admin spend')
    }
  }

  @method()
  checkGuard(
    guardState: CAT20GuardConstState,
    t_cat20ScriptHash: ByteString,
    t_cat20InputIndexVal: bigint,
    guardInputIndexVal: bigint,
    t_spentScriptsCtx: SpentScriptHashes,
    t_spentDataHashesCtx: SpentDataHashes
  ): void {
    // 1. check there is a guard input by shPreimage.hashSpentScriptHashes
    const guardScriptHash = ContextUtils.getSpentScriptHash(t_spentScriptsCtx, guardInputIndexVal);
    assert(
      guardScriptHash == this.guardVariantScriptHashes[0] || guardScriptHash == this.guardVariantScriptHashes[1] ||
      guardScriptHash == this.guardVariantScriptHashes[2] || guardScriptHash == this.guardVariantScriptHashes[3],
      'guard script hash is invalid'
    );
    assert(ContextUtils.getSpentDataHash(t_spentDataHashesCtx, guardInputIndexVal) == CAT20GuardStateLib.stateHash(guardState), 'guard state hash is invalid');

    // 2. check the guard input is validating current input by checking guard state contains current token script
    // and the corresponding value of array tokenScripts and tokenScriptIndexes is correct
    const tokenScriptIndex = byteStringToInt(slice(guardState.tokenScriptIndexes, t_cat20InputIndexVal, t_cat20InputIndexVal + 1n))
    assert(
      guardState.tokenScriptHashes[Number(tokenScriptIndex)] ==
        t_cat20ScriptHash,
      'token script hash is invalid'
    )
  }
}
