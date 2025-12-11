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
  applyFixedArray,
  normalizeUtxoScripts,
} from './utils/index.js'

export { checkArgument, checkState } from './utils/check.js'

export {
  ContractPeripheral,
  CAT20OpenMinterPeripheral,
  CAT20GuardPeripheral,
  CAT721GuardPeripheral,
} from './utils/contractPeripheral.js'

export { loadAllArtifacts } from './utils/loadAllArtifacts.js'

import { loadAllArtifacts as _loadAllArtifacts } from './utils/loadAllArtifacts.js'

_loadAllArtifacts()
