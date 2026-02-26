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
  SpentDataHashes,
  len
} from '@opcat-labs/scrypt-ts-opcat'
import { OwnerUtils } from '../utils/ownerUtils.js'
import { CAT20State, CAT20GuardConstState } from './types.js'
import {
  CAT20ContractUnlockArgs,
} from '../types.js'
import { GUARD_VARIANTS_COUNT, SHA256_HASH_LEN, SPEND_TYPE_USER_SPEND, SPEND_TYPE_CONTRACT_SPEND, SPEND_TYPE_ADMIN_SPEND } from '../constants.js'
import { CAT20GuardStateLib } from './cat20GuardStateLib.js'
import { CatTags } from '../catTags.js'
import { CAT20GuardVariants } from './cat20GuardVariants.js'

/**
 * The CAT20 contract
 * @category Contract
 * @category CAT20
 * @onchain
 */
@tags([CatTags.CAT20_TAG])
export class CAT20 extends SmartContract<CAT20State> {
  @prop()
  static readonly guardVariantScriptHashes: FixedArray<Sha256, typeof GUARD_VARIANTS_COUNT> = [
    CAT20GuardVariants.CANONICAL_GUARD_6_6_2,
    CAT20GuardVariants.CANONICAL_GUARD_6_6_4,
    CAT20GuardVariants.CANONICAL_GUARD_12_12_2,
    CAT20GuardVariants.CANONICAL_GUARD_12_12_4,
  ]

  @prop()
  minterScriptHash: ByteString

  @prop()
  hasAdmin: boolean

  @prop()
  adminScriptHash: ByteString

  constructor(
    minterScriptHash: ByteString,
    hasAdmin: boolean,
    adminScriptHash: ByteString
  ) {
    super(...arguments)
    this.minterScriptHash = minterScriptHash
    this.hasAdmin = hasAdmin
    this.adminScriptHash = adminScriptHash
    // C.1 Fix: Ensure admin script hash is valid when hasAdmin is true
    if (hasAdmin) {
      assert(
        len(adminScriptHash) == SHA256_HASH_LEN,
        'admin script hash must be 32 bytes when hasAdmin is true'
      )
    } else {
      assert(
        adminScriptHash == toByteString(''),
        'admin script hash must be empty when hasAdmin is false'
      )
    }
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
      unlockArgs.spendType >= SPEND_TYPE_USER_SPEND && unlockArgs.spendType <= SPEND_TYPE_ADMIN_SPEND,
      'invalid spendType'
    )

    let spentScriptHash = toByteString('')
    // For contract or admin spend,
    // spendScriptInputIndex must be >= 0 to prevent empty script hash bypass
    if (unlockArgs.spendType == SPEND_TYPE_CONTRACT_SPEND || unlockArgs.spendType == SPEND_TYPE_ADMIN_SPEND) {
      assert(
        unlockArgs.spendScriptInputIndex >= 0n,
        'spendScriptInputIndex must be >= 0 for contract or admin spend'
      )
      // Check upper bound to prevent out-of-bounds access
      assert(
        unlockArgs.spendScriptInputIndex < this.ctx.inputCount,
        'script index out of bounds'
      )
      // F2 Fix: Prevent self-reference - spendScriptInputIndex cannot point to current token input
      assert(
        unlockArgs.spendScriptInputIndex != this.ctx.inputIndex,
        'spendScriptInputIndex cannot reference self'
      )
      // F2 Fix: Prevent pointing to guard input
      assert(
        unlockArgs.spendScriptInputIndex != guardInputIndex,
        'spendScriptInputIndex cannot reference guard'
      )
      spentScriptHash = ContextUtils.getSpentScriptHash(
        this.ctx.spentScriptHashes,
        unlockArgs.spendScriptInputIndex
      )
    }
    if (unlockArgs.spendType == SPEND_TYPE_USER_SPEND) {
      // user spend
      // unlock token owned by user key
      OwnerUtils.checkUserOwner(unlockArgs.userPubKey, this.state.ownerAddr)
      assert(this.checkSig(unlockArgs.userSig, unlockArgs.userPubKey))
    } else if (unlockArgs.spendType == SPEND_TYPE_CONTRACT_SPEND) {
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
      guardScriptHash == CAT20.guardVariantScriptHashes[0] || guardScriptHash == CAT20.guardVariantScriptHashes[1] ||
      guardScriptHash == CAT20.guardVariantScriptHashes[2] || guardScriptHash == CAT20.guardVariantScriptHashes[3],
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
