import { prop, ByteString, SmartContract, method, BacktraceInfo, assert, ContextUtils, len, sha256, SpentScriptHashes, tags, slice, byteStringToInt, FixedArray, Sha256 } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721ContractUnlockArgs } from "../types.js";
import { CAT721GuardConstState, CAT721State } from "./types.js";
import { CAT721GuardStateLib } from "./cat721GuardStateLib.js";
import { OWNER_ADDR_CONTRACT_HASH_BYTE_LEN, NFT_GUARD_VARIANTS_COUNT } from "../constants.js";
import { OwnerUtils } from "../utils/ownerUtils.js";
import { SpentDataHashes } from "@opcat-labs/scrypt-ts-opcat/dist/types/smart-contract/types/structs";
import { CatTags } from "../catTags.js";

/**
 * The CAT721 contract
 * @category Contract
 * @category CAT721
 * @onchain
 */
@tags([CatTags.CAT721_TAG])
export class CAT721 extends SmartContract<CAT721State> {

  @prop()
  minterScriptHash: ByteString

  @prop()
  guardVariantScriptHashes: FixedArray<Sha256, typeof NFT_GUARD_VARIANTS_COUNT>;

  constructor(minterScriptHash: ByteString, guardVariantScriptHashes: FixedArray<Sha256, typeof NFT_GUARD_VARIANTS_COUNT>) {
    super(...arguments)
    this.minterScriptHash = minterScriptHash
    this.guardVariantScriptHashes = guardVariantScriptHashes
  }

  @method()
  public unlock(
    unlockArgs: CAT721ContractUnlockArgs,
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
      assert(unlockArgs.contractInputIndex >= 0n && unlockArgs.contractInputIndex < this.ctx.inputCount, 'contract input index is invalid')
      assert(this.state.ownerAddr == ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, unlockArgs.contractInputIndex), 'contract input script is invalid')
    } else {
      OwnerUtils.checkUserOwner(unlockArgs.userPubKey, this.state.ownerAddr);
      assert(this.checkSig(unlockArgs.userSig, unlockArgs.userPubKey), 'user signature check failed')
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
    const guardScriptHash = ContextUtils.getSpentScriptHash(t_spentScriptsCtx, guardInputIndex);
    assert(
      guardScriptHash == this.guardVariantScriptHashes[0] || guardScriptHash == this.guardVariantScriptHashes[1] ||
      guardScriptHash == this.guardVariantScriptHashes[2] || guardScriptHash == this.guardVariantScriptHashes[3],
      'guard script hash is invalid'
    );
    assert(ContextUtils.getSpentDataHash(t_spentDataHashesCtx, guardInputIndex) == CAT721GuardStateLib.stateHash(guardState), 'guard state hash is invalid')

    // guard state contains current token script
    // and the corresponding value of array nftScriptHashes and nftScriptIndexes is correct
    const cat721ScriptIndex = byteStringToInt(slice(guardState.nftScriptIndexes, t_cat721InputIndex, t_cat721InputIndex + 1n));
    assert(guardState.nftScriptHashes[Number(cat721ScriptIndex)] == t_cat721ScriptHash, 'nft script hash is invalid')
  }

}
