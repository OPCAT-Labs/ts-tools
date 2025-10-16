import { ABICoder } from "../../abi.js";
import { AbstractContract } from "../../abstractContract.js";
import { Artifact } from "../../types/artifact.js";


export class HashedMapAbiUtil {
  static readonly SYMBOLS = {
    HASHED_MAP_SCRYPT_TYPE: '__ScryptInternalHashedMap__',
    SCRYPT_SPLITTERS: {
      DOT: '__dot__',
      BRACKET_LEFT: '__brl__',
      BRACKET_RIGHT: '__brr__',
      HASHED_MAP_CTX_GENERIC_TYPE_SPLITTER: '_hm_',
    },
    JS_SPLITTERS: {
      DOT: '.',
      BRACKET_LEFT: '[',
      BRACKET_RIGHT: ']',
    },
    SCRYPT_VARIABLES: {
      NEXT_STATE: '__scrypt_ts_nextState',
      CUR_STATE: '__scrypt_ts_curState',
      STATE_HELPER_FUNCTION: '__scrypt__stateHelper',
    },
    SCRYPT_PREFIXERS: {
      HASHED_MAP_CTX_VARIABLE: '__scrypt_ts_hashedMapCtx__',
      HASHED_MAP_CTX_TYPE: 'ScryptTSHashedMapCtx'
    }
  }

  static fieldPathToScryptSymbol(fieldPath: string) {
    return fieldPath.replaceAll(this.SYMBOLS.JS_SPLITTERS.DOT, this.SYMBOLS.SCRYPT_SPLITTERS.DOT)
      .replaceAll(this.SYMBOLS.JS_SPLITTERS.BRACKET_LEFT, this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_LEFT)
      .replaceAll(this.SYMBOLS.JS_SPLITTERS.BRACKET_RIGHT, this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_RIGHT);
  }
  static fieldPathToJsSymbol(fieldPath: string) {
    return fieldPath.replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.DOT, this.SYMBOLS.JS_SPLITTERS.DOT)
      .replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_LEFT, this.SYMBOLS.JS_SPLITTERS.BRACKET_LEFT)
      .replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_RIGHT, this.SYMBOLS.JS_SPLITTERS.BRACKET_RIGHT);
  }

  static getHashedMapCtxByState(artifact: Artifact, stateFieldPath: string) {
    const stateHelperFunc = artifact.staticAbi.find(f => f.name === this.SYMBOLS.SCRYPT_VARIABLES.STATE_HELPER_FUNCTION);
    const ctxVarName = `${this.SYMBOLS.SCRYPT_PREFIXERS.HASHED_MAP_CTX_VARIABLE}${this.SYMBOLS.SCRYPT_VARIABLES.NEXT_STATE}${this.SYMBOLS.SCRYPT_SPLITTERS.DOT}${this.fieldPathToScryptSymbol(stateFieldPath)}`;
    if (!stateHelperFunc) {
      throw new Error(`State helper function ${this.SYMBOLS.SCRYPT_VARIABLES.STATE_HELPER_FUNCTION} not found in artifact`);
    }
    const param = stateHelperFunc.params.find(p => p.name === ctxVarName);
    if (!param) {
      throw new Error(`Context variable ${ctxVarName} not found in artifact`);
    }
    return param;
  }

  static getHashedMapCtxByFunctionParam(artifact: Artifact, methodName: string, paramName: string, stateFieldPath: string) {
    const method = artifact.abi.find(f => f.name === methodName);
    if (!method) {
      throw new Error(`Method ${methodName} not found in artifact`);
    }
    const param = method.params.find(p => p.name === paramName);
    if (!param) {
      throw new Error(`Parameter ${paramName} not found in artifact`);
    }
    if (paramName === this.SYMBOLS.SCRYPT_VARIABLES.CUR_STATE) {
      paramName = this.SYMBOLS.SCRYPT_VARIABLES.NEXT_STATE;
    }
    const ctxVarName = `${this.SYMBOLS.SCRYPT_PREFIXERS.HASHED_MAP_CTX_VARIABLE}${paramName}${this.SYMBOLS.SCRYPT_SPLITTERS.DOT}${this.fieldPathToScryptSymbol(stateFieldPath)}`;
    const ctxParam = method.params.find(p => p.name === ctxVarName);
    if (!ctxParam) {
      throw new Error(`Context variable ${ctxVarName} not found in artifact`);
    }
    return ctxParam
  }

  static checkTwoHashedMapCtxTypesEqual(type1: string, artifact1: Artifact, type2: string, artifact2: Artifact): boolean {
    const abiCoder1 = new ABICoder(artifact1);
    const abiCoder2 = new ABICoder(artifact2);
    const fields1 = abiCoder1.flattenStruct({}, type1, true);
    const fields2 = abiCoder2.flattenStruct({}, type2, true);
    if (fields1.length !== fields2.length) {
      return false;
    }
    for (let i = 0; i < fields1.length; i++) {
      if (fields1[i].name !== fields2[i].name || fields1[i].type !== fields2[i].type) {
        return false;
      }
    }
    return true;
  }

  static getHashedMapGenericsByCtxType(ctxType: string, artifact: Artifact) {
    const ctxStruct = artifact.structs.find(s => s.name === ctxType);
    if (!ctxStruct) {
      throw new Error(`Context type ${ctxType} not found in artifact`);
    }
    const keyType = ctxStruct.params.find(p => p.name === 'keys')?.type.split('[')[0];
    if (!keyType) {
      throw new Error(`Key type not found in context type ${ctxType}`);
    }
    const valueType = ctxStruct.params.find(p => p.name === 'leafValues')?.type.split('[')[0];
    if (!valueType) {
      throw new Error(`Value type not found in context type ${ctxType}`);
    }
    const maxAccessKeys = +ctxStruct.params.find(p => p.name === 'keys')?.type.split('[')[1].split(']')[0];
    if (!maxAccessKeys) {
      throw new Error(`Max access keys not found in context type ${ctxType}`);
    }
    return { keyType, valueType, maxAccessKeys };
  }

  static findHashedMapFieldsInStateType(artifact: Artifact) {
    const stateType = artifact.stateType!;
    if (!stateType) {
      throw new Error(`State type not found in artifact`);
    }
    const abiCoder = new ABICoder(artifact);
    const fields = abiCoder.flattenStruct({}, stateType, true);
    let fieldPaths: string[] = [];
    fields.forEach(field => {
      const isHashedMapNameFeild = field.name.endsWith('._root') && field.type === 'bytes';
      const hashedMapFieldName = field.name.slice('flattened_struct.'.length, -'._root'.length);
      const hashedMapFields = fields.filter(f => f.name.startsWith('flattened_struct.' + hashedMapFieldName));
      if (hashedMapFields.length === 1 && isHashedMapNameFeild) {
        fieldPaths.push(hashedMapFieldName);
      }
    })
    return fieldPaths;
  }

  static getFieldValueByPath(state: any, path: string) {
    const fields = this.getFieldListByPath(path);
    let cur = state;
    for (const field of fields) {
      cur = cur[field.value];
    }
    return cur;
  }

  static setFieldValueByPath(state: any, path: string, value: any) {
    const fields = this.getFieldListByPath(path);
    let cur = state;
    const prefix = fields.slice(0, -1)
    const last = fields[fields.length - 1];
    for (const field of prefix) {
      cur = cur[field.value];
    }
    cur[last.value] = value;
    return state;
  }

  static getFieldListByPath(fieldPath: string) {
    fieldPath = fieldPath.replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.DOT, this.SYMBOLS.JS_SPLITTERS.DOT)
      .replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_LEFT, this.SYMBOLS.JS_SPLITTERS.BRACKET_LEFT)
      .replaceAll(this.SYMBOLS.SCRYPT_SPLITTERS.BRACKET_RIGHT, this.SYMBOLS.JS_SPLITTERS.BRACKET_RIGHT);
    const result: ({ type: 'dot', value: string } | { type: 'array', value: number })[] = [];
      const regex = /(\w+)|\[(\d+)\]/g;
      let match;

      while ((match = regex.exec(fieldPath)) !== null) {
        if (match[1]) {
          result.push({ type: 'dot', value: match[1] });
        } else if (match[2]) {
          result.push({ type: 'array', value: parseInt(match[2], 10) });
        }
      }
      return result;
  }

  static exportHashedMapTrackerConfig(
    // the contract instance, it's state has the hashedmap field
    contract: AbstractContract,
    // the field path of the hashedmap field in the state
    stateFieldPath: string,
    // the possible initial states of the contract
    initialStates: any[],
    // the updaters of the hashedmap field
    updaters: {
      // the contract instance, it's public function will be called to update the hashedmap field
      contract: AbstractContract,
      // the method name of the public function
      methodName: string,
      // the parameter name of the public function, if the parameter is the state, set it to 'this.state', otherwise set it to the parameter name in the public function
      methodParamName: string
    }[]
  ) {
    // bind artifacts
    initialStates.forEach(initialState => {
      (contract.constructor as typeof AbstractContract).serializeState(initialState);
    });
    const hashedMapFields = HashedMapAbiUtil.findHashedMapFieldsInStateType((contract.constructor as any).artifact);
    if (!hashedMapFields.includes(stateFieldPath)) {
      throw new Error(`State field path ${stateFieldPath} is not a hashed map field in ${contract.constructor.name}`);
    }
    const typeArtifact = (contract.constructor as any).artifact;
    const type = {
      scripthash: (contract as any).lockingScriptHash,
      stateFieldPath,
      artifact: JSON.stringify(typeArtifact),
    }
    const config = {
      type,
      updaters: updaters.map((updater, updaterIndex) => {
        if (!(updater.contract.constructor as any).artifact) {
          throw new Error(`Artifact is not loaded for the contract: ${updater.contract.constructor.name}`);
        }
        const methodParamName = updater.methodParamName === 'this.state' ? HashedMapAbiUtil.SYMBOLS.SCRYPT_VARIABLES.CUR_STATE : updater.methodParamName;
        const artifact: Artifact = (updater.contract.constructor as any).artifact;
        const method = artifact.abi.find(f => f.name === updater.methodName);
        if (!method) {
          throw new Error(`Method ${updater.methodName} not found in ${updater.contract.constructor.name} artifact, updater index: ${updaterIndex}`);
        }
        const param = method.params.find(p => p.name === methodParamName);
        if (!param) {
          throw new Error(`Parameter ${methodParamName} not found in ${updater.contract.constructor.name} ${updater.methodName} method, updater index: ${updaterIndex}`);
        }

        const typeSameAsState = HashedMapAbiUtil.checkTwoHashedMapCtxTypesEqual(typeArtifact.stateType!, artifact, param.type, artifact);
        if (!typeSameAsState) {
          throw new Error(`Parameter ${methodParamName} type is not the same as the state type in ${contract.constructor.name}, state type: ${typeArtifact.stateType}, parameter type: ${param.type}, updater index: ${updaterIndex}`);
        }

        return {
          scripthash: (updater.contract as any).lockingScriptHash,
          artifact: JSON.stringify((updater.contract.constructor as any).artifact),
          methodName: updater.methodName,
          methodParamName: methodParamName,
          methodParamField: type.stateFieldPath,
        }
      }),
      initialKVsList: initialStates.map(initialState => {
        (contract.constructor as any).serializeState(initialState);
        const hashedMap = HashedMapAbiUtil.getFieldValueByPath(initialState, type.stateFieldPath);
        return hashedMap.serializedEntries();
      }),
    }
    return config;
  }
}