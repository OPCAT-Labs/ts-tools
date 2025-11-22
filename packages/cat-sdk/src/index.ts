export * from './contracts/index.js'
export * from './features/cat20/index.js'
export * from './features/cat721/index.js'
export * from './lib/index.js'
export * from './typeConstants.js'

export {
  toTxOutpoint,
  outpoint2ByteString,
  toTokenOwnerAddress,
  stringToHex,
  hexToString,  
  getDummyUtxo,
} from './utils/index.js'

export {
  ContractPeripheral,
  CAT20OpenMinterPeripheral,
  CAT20GuardPeripheral,
  CAT721GuardPeripheral,
} from './utils/contractPeripheral.js'

import { loadAllArtifacts } from './utils/loadAllArtifacts.js'

loadAllArtifacts()
