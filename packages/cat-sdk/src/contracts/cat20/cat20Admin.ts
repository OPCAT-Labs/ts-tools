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
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20AdminState } from './types'
import { OwnerUtils } from '../utils/ownerUtils'
import { CatTags } from '../catTags'

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
}
