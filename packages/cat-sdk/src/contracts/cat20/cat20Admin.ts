import {
  SmartContract,
  method,
  prop,
  assert,
  ByteString,
  Sig,
  PubKey,
  BacktraceInfo,
  TxUtils,
  PubKeyHash,
  tags,
  unlock,
  UnlockContext,
  getBackTraceInfo,
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20AdminState } from './types.js'
import { OwnerUtils } from '../utils/ownerUtils.js'
import { CatTags } from '../catTags.js'

/**
 * Parameters for unlocking CAT20Admin via transferOwnership method.
 * @category CAT20
 */
export interface CAT20AdminTransferOwnershipParams extends Record<string, unknown> {
  /** The public key of the admin */
  publicKey: string;
  /** The address of the admin for signature lookup */
  address: string;
  /** The new owner's public key hash */
  newPubKeyHash: PubKeyHash;
  /** Backtrace info: previous transaction hex */
  prevTxHex: string;
  /** Backtrace info: previous previous transaction hex */
  prevPrevTxHex: string;
  /** Backtrace info: previous transaction input index */
  prevTxInput: number;
}

/**
 * Parameters for unlocking CAT20Admin via authorizeToSpendToken method.
 * @category CAT20
 */
export interface CAT20AdminAuthorizeParams extends Record<string, unknown> {
  /** The public key of the admin */
  publicKey: string;
  /** The address of the admin for signature lookup */
  address: string;
  /** Backtrace info: previous transaction hex */
  prevTxHex: string;
  /** Backtrace info: previous previous transaction hex */
  prevPrevTxHex: string;
  /** Backtrace info: previous transaction input index */
  prevTxInput: number;
}

@tags([CatTags.CAT20_ADMIN_TAG])
export class CAT20Admin extends SmartContract<CAT20AdminState> {
  @prop()
  genesisOutpoint: ByteString

  constructor(genesisOutpoint: ByteString) {
    super(...arguments)
    this.genesisOutpoint = genesisOutpoint
  }

  @method()
  public authorizeToSpendToken(
    // args to
    adminPubKey: PubKey,
    adminSig: Sig,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    // back to genesis
    const adminScriptHash = this.ctx.spentScriptHash
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)

    // check admin
    OwnerUtils.checkUserOwner(adminPubKey, this.state.adminAddress)
    assert(this.checkSig(adminSig, adminPubKey))

    // next admin output
    const adminOutput = TxUtils.buildDataOutput(
      adminScriptHash,
      this.ctx.value,
      this.ctx.spentDataHash
    )

    // confine curTx outputs
    assert(this.checkOutputs(adminOutput + this.buildChangeOutput()))
  }

  @method()
  public transferOwnership(
    // args to
    adminPubKey: PubKey,
    adminSig: Sig,
    newPubKeyHash: PubKeyHash,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    // back to genesis
    const adminScriptHash = this.ctx.spentScriptHash
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)
    // check admin
    OwnerUtils.checkUserOwner(adminPubKey, this.state.adminAddress)
    assert(this.checkSig(adminSig, adminPubKey))

    // update ownerAddress
    this.state.adminAddress =
      OwnerUtils.pubKeyHashtoLockingScript(newPubKeyHash)
    // next admin output
    const adminOutput = TxUtils.buildDataOutput(
      adminScriptHash,
      this.ctx.value,
      CAT20Admin.stateHash(this.state)
    )
    // confine curTx outputs
    assert(this.checkOutputs(adminOutput + this.buildChangeOutput()))
  }

  /**
   * Paired unlock method for the `transferOwnership` lock method.
   */
  @unlock(CAT20Admin, 'transferOwnership')
  static unlockTransferOwnership(ctx: UnlockContext<CAT20Admin, CAT20AdminTransferOwnershipParams>): void {
    const { contract, psbt, inputIndex, extraParams } = ctx;

    if (!extraParams) {
      throw new Error('CAT20Admin.unlockTransferOwnership requires extraParams');
    }

    const {
      publicKey,
      address,
      newPubKeyHash,
      prevTxHex,
      prevPrevTxHex,
      prevTxInput,
    } = extraParams;

    const sig = psbt.getSig(inputIndex, { address });

    contract.transferOwnership(
      PubKey(publicKey),
      sig,
      newPubKeyHash,
      getBackTraceInfo(prevTxHex, prevPrevTxHex, prevTxInput)
    );
  }

  /**
   * Paired unlock method for the `authorizeToSpendToken` lock method.
   */
  @unlock(CAT20Admin, 'authorizeToSpendToken')
  static unlockAuthorizeToSpendToken(ctx: UnlockContext<CAT20Admin, CAT20AdminAuthorizeParams>): void {
    const { contract, psbt, inputIndex, extraParams } = ctx;

    if (!extraParams) {
      throw new Error('CAT20Admin.unlockAuthorizeToSpendToken requires extraParams');
    }

    const {
      publicKey,
      address,
      prevTxHex,
      prevPrevTxHex,
      prevTxInput,
    } = extraParams;

    const sig = psbt.getSig(inputIndex, { address });

    contract.authorizeToSpendToken(
      PubKey(publicKey),
      sig,
      getBackTraceInfo(prevTxHex, prevPrevTxHex, prevTxInput)
    );
  }
}
