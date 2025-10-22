export { ExtPsbt } from './psbt/extPsbt.js';
export { Psbt } from './psbt/psbt.js';
export { type OpcatUtxo } from './psbt/utxoConverter.js'
export { type IExtPsbt, type ContractCall } from './psbt/types.js';

// smart contract core classes & interfaces
export { SmartContract } from './smart-contract/smartContract.js';
export { SmartContractLib } from './smart-contract/smartContractLib.js';
export { method, prop, type MethodDecoratorOptions, tags } from './smart-contract/decorators.js';
export {
  Address,
  Block,
  MerkleBlock,
  BlockHeader,
  HDPrivateKey,
  HDPublicKey,
  Sighash,
  TransactionSignature,
  Output,
  Input,
  Networks,
  Network,
  Opcode,
  PrivateKey,
  PublicKey,
  Script,
  Interpreter,
  Transaction,
  HashCache,
  Message,
  Mnemonic,
  errors,
  util,
  encoding,
  crypto,
} from '@opcat-labs/opcat';

import * as opcat from '@opcat-labs/opcat';

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

export * from './smart-contract/abi.js';

export * from './signers/index.js';

export * from './providers/index.js';

export * from './utils/index.js';

// basic built-in features
export * from './features/index.js';

export { toSupportedNetwork, fromSupportedNetwork } from './networks.js';

export { type SupportedNetwork, type UTXO, type ExtUtxo, type B2GUTXO } from './globalTypes.js';

export { opcat };
