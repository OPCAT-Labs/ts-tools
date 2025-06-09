export { ExtPsbt, type IExtPsbt } from './psbt/extPsbt.js';

export { Covenant, StatefulCovenant, type StatefulCovenantUtxo } from './covenant.js';

// smart contract core classes & interfaces
export { SmartContract } from './smart-contract/smartContract.js';
export { SmartContractLib } from './smart-contract/smartContractLib.js';
export { method, prop, type MethodDecoratorOptions } from './smart-contract/decorators.js';

// smart contract artifact
export {
  type Artifact,
  CURRENT_CONTRACT_ARTIFACT_VERSION,
  SUPPORTED_MINIMUM_VERSION,
  type ABI,
  type ABIEntity,
  ABIEntityType,
  type ParamEntity,
  type StructEntity,
  type LibraryEntity,
  type ContractEntity,
  type AliasEntity,
  type StaticEntity,
} from './smart-contract/types/artifact.js';

export {
  type TypeResolver,
  type TypeInfo,
  ScryptType,
  SymbolType,
  isScryptType,
  isBytes,
  isSubBytes,
} from './smart-contract/types/abi.js';

// smart contract built-in constants
export * from './smart-contract/consts.js';

// smart contract built-in types
export * from './smart-contract/types/index.js';

// smart contract built-in functions
export * from './smart-contract/fns/index.js';

// smart contract built-in libraries
export * from './smart-contract/builtin-libs/index.js';

export * from './signers/index.js';

export * from './providers/index.js';

export * from './utils/index.js';

// basic built-in features
export * from './features/index.js';

export { type SupportedNetwork, type UTXO, type Witness } from './globalTypes.js';
