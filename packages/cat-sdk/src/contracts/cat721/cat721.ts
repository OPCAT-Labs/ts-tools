import { prop, ByteString, SmartContract, method, BacktraceInfo, assert, ContextUtils, len, sha256, SpentScriptHashes } from "@opcat-labs/scrypt-ts-opcat";
import { ContractUnlockArgs } from "../types";
import { CAT721GuardConstState, CAT721State } from "./types";
import { CAT721StateLib } from "./cat721StateLib";
import { CAT721GuardStateLib } from "./cat721GuardStateLib";
import { OWNER_ADDR_CONTRACT_HASH_BYTE_LEN } from "../constants";
import { OwnerUtils } from "../utils/ownerUtils";
import { SpentDataHashes } from "@opcat-labs/scrypt-ts-opcat/dist/types/smart-contract/types/structs";



export class CAT721 extends SmartContract<CAT721State> {
    
  @prop()
  minterScriptHash: ByteString

  @prop()
  guardScriptHash: ByteString

  constructor(minterScriptHash: ByteString, guardScriptHash: ByteString) {
    super(...arguments)
    this.minterScriptHash = minterScriptHash
    this.guardScriptHash = guardScriptHash
  }

  @method()
  public unlock(
    unlockArgs: ContractUnlockArgs,
    // guard
    guardState: CAT721GuardConstState,
    guardInputIndex: bigint,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    this.backtraceToScript(backtraceInfo, this.minterScriptHash);

    this.checkGuard(
      guardState,
      this.ctx.spentScriptHash,
      this.ctx.inputIndex,
      guardInputIndex,
      this.ctx.spentScriptHashes,
      this.ctx.spentDataHashes
    )

    if (len(this.state.ownerAddr) == OWNER_ADDR_CONTRACT_HASH_BYTE_LEN) {
      // unlock token owned by contract script
      assert(unlockArgs.contractInputIndex >= 0n && unlockArgs.contractInputIndex < this.ctx.inputCount)
      assert(this.state.ownerAddr == ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, unlockArgs.contractInputIndex))
    } else {
      OwnerUtils.checkUserOwner(unlockArgs.userPubKey, this.state.ownerAddr);
      assert(this.checkSig(unlockArgs.userSig, unlockArgs.userPubKey))
    }
  }

  @method()
  checkGuard(
    guardState: CAT721GuardConstState,
    t_cat721ScriptHash: ByteString,
    t_cat721InputIndex: bigint,
    guardInputIndex: bigint,
    t_spentScriptsCtx: SpentScriptHashes,
    t_spentDataHashesCtx: SpentDataHashes,
  ): void {
    // guard state contains current token state hash
    assert(ContextUtils.getSpentScriptHash(t_spentScriptsCtx, guardInputIndex) == this.guardScriptHash)
    assert(ContextUtils.getSpentDataHash(t_spentDataHashesCtx, guardInputIndex) == CAT721GuardStateLib.stateHash(guardState))

    // guard state contains current token script
    // and the corresponding value of array nftScriptHashes and nftScriptIndexes is correct
    const cat721ScriptIndex = guardState.nftScriptIndexes[Number(t_cat721InputIndex)];
    assert(guardState.nftScriptHashes[Number(cat721ScriptIndex)] == t_cat721ScriptHash)
  }

}