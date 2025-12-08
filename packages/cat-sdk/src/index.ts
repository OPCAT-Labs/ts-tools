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
  applyFixedArray,
  normalizeUtxoScripts,
} from './utils/index'

export { checkArgument, checkState } from './utils/check'

export {
  ContractPeripheral,
  CAT20OpenMinterPeripheral,
  CAT20GuardPeripheral,
  CAT721GuardPeripheral,
} from './utils/contractPeripheral'

export { loadAllArtifacts } from './utils/loadAllArtifacts'

import { loadAllArtifacts as _loadAllArtifacts } from './utils/loadAllArtifacts'

_loadAllArtifacts()
