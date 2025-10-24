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
} from '@opcat-labs/scrypt-ts-opcat'
import { CAT20AdminState } from './types'
import { OwnerUtils } from '../utils/ownerUtils'

export class CAT20Admin extends SmartContract<CAT20AdminState> {
  @prop()
  genesisOutpoint: ByteString

  constructor(genesisOutpoint: ByteString) {
    super(...arguments)
    this.genesisOutpoint = genesisOutpoint
  }

  @method()
  public freeze(
    // args to
    adminPubKey: PubKey,
    adminSig: Sig,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    // back to genesis
    const adminScript = this.ctx.spentScriptHash
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)

    // check admin
    OwnerUtils.checkUserOwner(adminPubKey, this.state.ownerAddress)
    assert(this.checkSig(adminSig, adminPubKey))

    // next admin output
    const adminOutput = TxUtils.buildDataOutput(
      adminScript,
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
    newAddress: ByteString,
    // backtrace
    backtraceInfo: BacktraceInfo
  ) {
    // back to genesis
    const adminScript = this.ctx.spentScriptHash
    this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint)
    // check admin
    OwnerUtils.checkUserOwner(adminPubKey, this.state.ownerAddress)
    assert(this.checkSig(adminSig, adminPubKey))
    // update ownerAddress
    this.state.ownerAddress = newAddress
    // next admin output
    const adminOutput = TxUtils.buildDataOutput(
      adminScript,
      this.ctx.value,
      CAT20Admin.stateHash(this.state)
    )
    // confine curTx outputs
    assert(this.checkOutputs(adminOutput + this.buildChangeOutput()))
  }
}
