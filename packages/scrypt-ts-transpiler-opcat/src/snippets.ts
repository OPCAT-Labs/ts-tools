export const InjectedParam_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedParam_InputIndexVal = '__scrypt_ts_inputIndexVal';
export const InjectedParam_Prevouts = '__scrypt_ts_prevouts';
export const InjectedParam_Prevout = '__scrypt_ts_prevout';
export const InjectedParam_SpentScriptHashes = '__scrypt_ts_spentScriptHashes';
export const InjectedParam_SpentAmounts = '__scrypt_ts_spentAmounts';
export const InjectedParam_SpentDataHashes = '__scrypt_ts_spentDataHashes';
export const InjectedParam_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedParam_NextStateHashes = '__scrypt_ts_nextStateHashes';
export const InjectedParam_CurState = '__scrypt_ts_curState';
export const InjectedParam_PrevTxHashPreimage = '__scrypt_ts_prevTxHashPreimage';

export const InjectedProp_SHPreimage = '__scrypt_ts_shPreimage';
export const InjectedProp_ChangeInfo = '__scrypt_ts_changeInfo';
export const InjectedProp_PrevoutsCtx = '__scrypt_ts_prevouts';
export const InjectedProp_Prevout = '__scrypt_ts_prevout';
export const InjectedProp_CurState = '__scrypt_ts_curState';
export const InjectedProp_NextState = '__scrypt_ts_nextState';
export const InjectedProp_SpentScriptHashes = '__scrypt_ts_spentScriptHashes';
export const InjectedProp_SpentAmounts = '__scrypt_ts_spentAmounts';
export const InjectedProp_SpentDataHashes = '__scrypt_ts_spentDataHashes';
export const InjectedProp_PrevTxHashPreimage = '__scrypt_ts_prevTxHashPreimage';


export const InjectedVar_InputCount = '__scrypt_ts_inputCount';
export const InjectedVar_StateCount = '__scrypt_ts_stateCount';
export const InjectedVar_StateOutputs = '__scrypt_ts_stateOutputs';
export const InjectedVar_StateRoots = '__scrypt_ts_stateRoots';
export const InjectedVar_InputStateHashes = '__scrypt_ts_inputStateHashes';
export const InjectedVar_NextState = '__scrypt_ts_nextState';

export const ScryptInternalHashedMap = '___ScryptInternalHashedMap__';

// export const BUILD_CHANGE_OUTPUT_FUNCTION = `
// function buildChangeOutput() : bytes {
//   return len(this.${InjectedProp_ChangeInfo}.satoshis) > 0 ? TxUtils.buildOutput(this.${InjectedProp_ChangeInfo}.script, this.${InjectedProp_ChangeInfo}.satoshis) : b'';
// }
// `;

// export const INIT_CHANGE = `this.${InjectedProp_ChangeInfo} = ${InjectedParam_ChangeInfo};`;

export function thisAssignment(intjectedProp: string) {
  return `this.${intjectedProp} = ${intjectedProp};`;
}

export const EMPTY_CONSTRUCTOR = `
constructor(){
}
`;

export const CALL_CHECK_SHPREIMAGE = `require(Tx.checkPreimageSigHashType(ContextUtils.serializeSHPreimage(${InjectedParam_SHPreimage}), SigHash.ALL))`;

export const CALL_BUILD_CHANGE_OUTPUT = {
  accessArgument: `(${InjectedParam_ChangeInfo}.satoshis > 0 ? TxUtils.buildOutput(${InjectedParam_ChangeInfo}.scriptHash, ${InjectedParam_ChangeInfo}.satoshis) : b'')`,
  accessThis: `(this.${InjectedProp_ChangeInfo}.satoshis > 0 ? TxUtils.buildOutput(this.${InjectedProp_ChangeInfo}.scriptHash, this.${InjectedProp_ChangeInfo}.satoshis) : b'')`,
};

export const ACCESS_INPUT_COUNT = {
  accessArgument: InjectedVar_InputCount,
  accessThis: `ContextUtils.checkSpentAmounts(this.${InjectedProp_SpentAmounts}, this.${InjectedProp_SHPreimage}.hashSpentAmounts)`,
}

export const HASHEDMAP_CONTEXT_STRUCT = (keyType: string, valueType: string, maxAccessKeys: number) => `
struct ${HASHEDMAP_NAMES.contextType(keyType, valueType, maxAccessKeys)} {
  bytes proofs;
  ${keyType}[${maxAccessKeys}] keys;
  ${valueType}[${maxAccessKeys}] leafValues;
  ${valueType}[${maxAccessKeys}] nextLeafValues;
  bytes accessIndexes;
}
`;

export const HASHEDMAP_NAMES = {
  contextType: (keyType: string, valueType: string, maxAccessKeys: number) => `ScryptTSHashedMapCtx_hm_${keyType}_hm_${valueType}_hm_${maxAccessKeys}`,
  libraryType: (keyType: string, valueType: string, maxAccessKeys: number) => `ScryptTSHashedMapLib_hm_${keyType}_hm_${valueType}_hm_${maxAccessKeys}`,

  contextVar: (fieldPrefix: string) => `__scrypt_ts_hashedMapCtx__${fieldPrefix.replaceAll('.', '__dot__').replaceAll('[', '__brl__').replaceAll(']', '__brr__')}`,
  libraryVar: (fieldPrefix: string) => `__scrypt_ts_hashedMapLib__${fieldPrefix.replaceAll('.', '__dot__').replaceAll('[', '__brl__').replaceAll(']', '__brr__')}`,
}

// export const HASHEDMAP_STATE_STRUCT_VARIABLE = (fieldPrefix: string) => fieldPrefix.replaceAll('.', '__dot__') + '__ctx';

// export const HASHEDMAP_STATE_LIB_VARIABLE = (fieldPrefix: string) => fieldPrefix.replaceAll('.', '__dot__') + '__lib';

export const HASHEDMAP_LIBRARY_TEMPLATE = (
  keyType: string,
  valueType: string,
  maxAccessKeys: number,
  serializeKeyFnBody: string,
  serializeValueFnBody: string,
  isSameValueFnBody: string
) => {
  const code = `
library ${HASHEDMAP_NAMES.libraryType(keyType, valueType, maxAccessKeys)} {
  static const int MAX_ACCESS_KEYS_ALLOWED = 127;
  static const int HASH_LEN = 20;
  static const int DEPTH = 160;
  static const int PROOF_LEN = 3220; 

  // HashedMap holds the root of the merkle tree
  private bytes _root;

  // injected by typescript sdk
  private bytes _nextRoot;
  private bytes _proofs;
  private ${keyType}[${maxAccessKeys}] _keys;
  private ${valueType}[${maxAccessKeys}] _leafValues;
  private ${valueType}[${maxAccessKeys}] _nextLeafValues;
  private bytes _accessIndexes;

  // temp variable
  private int _accessCount;
  private bool _dataFunctionCalled;

  constructor(bytes root) {
    this._root = root;
  }

  function init (bytes proofs, ${keyType}[${maxAccessKeys}] keys, ${valueType}[${maxAccessKeys}] leafValues, ${valueType}[${maxAccessKeys}] nextLeafValues, bytes accessIndexes): bool {
    this._proofs = proofs;
    this._keys = keys;
    this._leafValues = leafValues;
    this._nextLeafValues = nextLeafValues;
    this._accessIndexes = accessIndexes;
    this._accessCount = 0;
    this._dataFunctionCalled = false;
    return this.verifyMerkleProof();
  }

  private function serializeKey(${keyType} key): bytes {
    ${serializeKeyFnBody}
  }

  private function serializeValue(${valueType} value): bytes {
    ${serializeValueFnBody}
  }

  private function isSameValue(${valueType} value, ${valueType} value2): bool {
    ${isSameValueFnBody}
  }

  private function verifyMerkleProof(): bool {
    // 1. check _proofs length is valid
    // 1.1 check if _proofs length is divisible by PROOF_LEN
    int proofCount = len(this._proofs) / PROOF_LEN;
    require(proofCount * PROOF_LEN == len(this._proofs));
    // 1.2 check if _proofs length is less than maxAccessKeys * PROOF_LEN
    require(proofCount <= ${maxAccessKeys});

    // 2. check _root, _nextRoot, _leafValues, _nextLeafValues are valid
    bytes nextRoot = this._root;
    loop(${maxAccessKeys}): i {
      if (i < proofCount) {
        bytes proof = this._proofs[i * PROOF_LEN : (i + 1) * PROOF_LEN];
        bytes keyHash = hash160(this.serializeKey(this._keys[i]));
        bytes leafHash = hash160(this.serializeValue(this._leafValues[i]));
        bytes nextLeafHash = hash160(this.serializeValue(this._nextLeafValues[i]));
        bytes expectedLeafHash = proof[0:HASH_LEN];
        bytes neighbors = proof[HASH_LEN: HASH_LEN + DEPTH * HASH_LEN];

        // make sure _leafValues[i] is the same as the leafHash in the proof
        require(expectedLeafHash == leafHash);
        // verify the merkle proof
        nextRoot = this.verifySingleMerkle(nextRoot, keyHash, leafHash, nextLeafHash, neighbors);
      }
    }
    this._nextRoot = nextRoot;
    return true;
  }

  private function verifySingleMerkle(bytes root, bytes keyHash, bytes leafHash, bytes nextLeafHash, bytes neighbors): bytes {
    int keyNumber = unpack(keyHash + b'00');
    bytes oldMerkleValue = leafHash;
    bytes newMerkleValue = nextLeafHash;
    loop(DEPTH): i {
      bool isNeighborLeft = keyNumber % 2 == 1;
      keyNumber = keyNumber / 2;
      bytes neighborItem = neighbors[i * HASH_LEN : (i + 1) * HASH_LEN];
      if (isNeighborLeft) {
        oldMerkleValue = hash160(neighborItem + oldMerkleValue);
        newMerkleValue = hash160(neighborItem + newMerkleValue);
      } else {
        oldMerkleValue = hash160(oldMerkleValue + neighborItem);
        newMerkleValue = hash160(newMerkleValue + neighborItem);
      }
    }
    require(root == oldMerkleValue);
    return newMerkleValue;
  }

  private function accessKey(${keyType} key): int {
    // there is some bugs in sCrypt compiler, so we cannot use ++this._accessCount
    // int accessIndex = unpack(this._accessIndexes[this._accessCount: ++this._accessCount]);

    int accessIndex = unpack(this._accessIndexes[this._accessCount: this._accessCount+1]);
    this._accessCount = this._accessCount + 1;

    require(accessIndex >= 0);
    bytes expectedKeyHash = this.serializeKey(this._keys[accessIndex]);
    bytes accessKeyHash = this.serializeKey(key);
    require(accessKeyHash == expectedKeyHash);
    return accessIndex;
  }

  // public function
  function get(${keyType} key):  ${valueType} {
    int accessIndex = this.accessKey(key);
    return this._leafValues[accessIndex];
  }

  // public function
  function set(${keyType} key, ${valueType} value): bool {
    // cannot call \`set\` function after \`data\` function is called
    require(!this._dataFunctionCalled);
    int accessIndex = this.accessKey(key);
    this._leafValues[accessIndex] = value;
    return true;
  }

  // public function, called by the end of the public function
  function verifyValues(): bool {
    int proofCount = len(this._proofs) / PROOF_LEN;
    loop(${maxAccessKeys}): i {
      if (i < proofCount) {
        require(this.isSameValue(this._leafValues[i], this._nextLeafValues[i]));
      }
    }
    return true;
  }

  // public function
  function data(): bytes {
    this._dataFunctionCalled = true;
    return this._nextRoot;
  }
}
`;

  // remove comments
  const purifiedCode = code.split('\n').map(line => {
    const index = line.indexOf('//')
    if (index !== -1) {
      line = line.slice(0, index);
      if (line.trim() === '') {
        return '';
      }
    }
    return line;
  }).filter(line => line !== '').join('\n');
  return purifiedCode;
}