import {
  prop,
  ByteString,
  SmartContract,
  method,
  BacktraceInfo,
  assert,
  ContextUtils,
  len,
  SpentScriptHashes,
  tags,
  slice,
  byteStringToInt,
  FixedArray,
  Sha256,
  unlock,
  UnlockContext,
  PubKey,
  getBackTraceInfo,
  SpentDataHashes,
} from "@opcat-labs/scrypt-ts-opcat";
import { CAT721ContractUnlockArgs } from "../types.js";
import { CAT721GuardConstState, CAT721State } from "./types.js";
import { CAT721GuardStateLib } from "./cat721GuardStateLib.js";
import { OWNER_ADDR_CONTRACT_HASH_BYTE_LEN, NFT_GUARD_VARIANTS_COUNT } from "../constants.js";
import { OwnerUtils } from "../utils/ownerUtils.js";
import { CatTags } from "../catTags.js";

/**
 * Parameters for unlocking a CAT721 NFT via the @unlock decorator pattern.
 *
 * @category CAT721
 */
export interface CAT721UnlockParams extends Record<string, unknown> {
  /** The guard contract state */
  guardState: CAT721GuardConstState;
  /** The input index of the guard contract */
  guardInputIndex: bigint;
  /** The public key of the NFT owner */
  publicKey: string;
  /** The address of the NFT owner for signature lookup */
  address: string;
  /** Backtrace info: previous transaction hex */
  prevTxHex: string;
  /** Backtrace info: previous previous transaction hex */
  prevPrevTxHex: string;
  /** Backtrace info: previous transaction input index */
  prevTxInput: number;
}

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

  /**
   * Paired unlock method for the `unlock` lock method.
   *
   * This static method is decorated with `@unlock(CAT721, 'unlock')` to create a pairing
   * with the `unlock` lock method. When `addContractInput(cat721, 'unlock', params)` is called,
   * this method will be automatically invoked.
   *
   * @param ctx - The unlock context containing the contract instance, PSBT, and extra parameters
   *
   * @example
   * ```typescript
   * sendPsbt.addContractInput(cat721Nft, 'unlock', {
   *   guardState,
   *   guardInputIndex: BigInt(guardInputIndex),
   *   publicKey,
   *   address,
   *   prevTxHex: backtraces[index].prevTxHex,
   *   prevPrevTxHex: backtraces[index].prevPrevTxHex,
   *   prevTxInput: backtraces[index].prevTxInput,
   * });
   * ```
   */
  @unlock(CAT721, 'unlock')
  static unlockUnlock(ctx: UnlockContext<CAT721, CAT721UnlockParams>): void {
    const { contract, psbt, inputIndex, extraParams } = ctx;

    if (!extraParams) {
      throw new Error('CAT721.unlockUnlock requires extraParams');
    }

    const {
      guardState,
      guardInputIndex,
      publicKey,
      address,
      prevTxHex,
      prevPrevTxHex,
      prevTxInput,
    } = extraParams;

    const sig = psbt.getSig(inputIndex, { address });

    contract.unlock(
      {
        userPubKey: PubKey(publicKey),
        userSig: sig,
        contractInputIndex: -1n,
      },
      guardState,
      guardInputIndex,
      getBackTraceInfo(prevTxHex, prevPrevTxHex, prevTxInput)
    );
  }
}
