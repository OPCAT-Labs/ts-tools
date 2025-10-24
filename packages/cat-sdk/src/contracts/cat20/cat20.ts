import {
  ByteString,
  SmartContract,
  prop,
  method,
  assert,
  len,
  BacktraceInfo,
  slice,
  SpentScriptHashes,
  TX_OUTPUT_SCRIPT_HASH_LEN,
  ContextUtils,
  sha256,
  toByteString,
} from '@opcat-labs/scrypt-ts-opcat'
import { OwnerUtils } from '../utils/ownerUtils'
import { CAT20State, CAT20GuardConstState } from './types'
import { ContractUnlockArgs } from '../types'
import { OWNER_ADDR_CONTRACT_HASH_BYTE_LEN } from '../constants'
import { SpentDataHashes } from '@opcat-labs/scrypt-ts-opcat/dist/types/smart-contract/types/structs'
import { CAT20GuardStateLib } from './cat20GuardStateLib'

export class CAT20 extends SmartContract<CAT20State> {
  @prop()
  minterScriptHash: ByteString

  @prop()
  adminScriptHash: ByteString

  @prop()
  guardScriptHash: ByteString

  constructor(
    minterScriptHash: ByteString,
    adminScriptHash: ByteString,
    guardScriptHash: ByteString
  ) {
    super(...arguments)
    this.minterScriptHash = minterScriptHash
    this.adminScriptHash = adminScriptHash
    this.guardScriptHash = guardScriptHash
  }

  @method()
  public unlock(
    unlockArgs: ContractUnlockArgs,
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
    let spentScriptHash = toByteString('')
    if (unlockArgs.contractInputIndex >= 0n) {
      spentScriptHash = ContextUtils.getSpentScriptHash(
        this.ctx.spentScriptHashes,
        unlockArgs.contractInputIndex
      )
    }

    if (spentScriptHash == this.adminScriptHash) {
      assert(true)
    } else {
      if (len(this.state.ownerAddr) == OWNER_ADDR_CONTRACT_HASH_BYTE_LEN) {
        // unlock token owned by contract script
        assert(this.state.ownerAddr == spentScriptHash)
      } else {
        // unlock token owned by user key
        OwnerUtils.checkUserOwner(unlockArgs.userPubKey, this.state.ownerAddr)
        assert(this.checkSig(unlockArgs.userSig, unlockArgs.userPubKey))
      }
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
    assert(
      ContextUtils.getSpentScriptHash(t_spentScriptsCtx, guardInputIndexVal) ==
        this.guardScriptHash
    )
    assert(
      ContextUtils.getSpentDataHash(t_spentDataHashesCtx, guardInputIndexVal) ==
        CAT20GuardStateLib.stateHash(guardState)
    )

    // 2. check the guard input is validating current input by checking guard state contains current token script
    // and the corresponding value of array tokenScripts and tokenScriptIndexes is correct
    const tokenScriptIndex =
      guardState.tokenScriptIndexes[Number(t_cat20InputIndexVal)]
    assert(
      guardState.tokenScriptHashes[Number(tokenScriptIndex)] ==
        t_cat20ScriptHash
    )
  }
}
