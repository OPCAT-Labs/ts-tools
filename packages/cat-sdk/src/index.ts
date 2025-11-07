export * from './contracts/index'
export * from './features/cat20/index'
export * from './features/cat721/index'
export * from './lib/index'
export * from './typeConstants'

export {
  toTxOutpoint,
  outpoint2ByteString,
  toTokenOwnerAddress,
  stringToHex,
  hexToString,
  getDummyUtxo,
} from './utils/index'

export {
  ContractPeripheral,
  CAT20OpenMinterPeripheral,
  CAT20GuardPeripheral,
} from './utils/contractPeripheral'

import { loadAllArtifacts } from './utils/loadAllArtifacts'

loadAllArtifacts()
