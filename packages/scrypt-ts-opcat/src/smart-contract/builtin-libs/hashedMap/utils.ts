import { ABICoder } from "../../abi.js";
import { Artifact } from "../../types/artifact.js";
import { HashedMap } from "./hashedMap.js";
import { cloneDeep } from "../../../utils/common.js";
import { TracedHashedMap } from "./tracedHashedMap.js";
import { verifyHashedMapContext } from "./hashedMapLibrary.js";
import { HashedMapAbiUtil } from "./hashedMapAbiUtil.js";

export function attachToStateType(
  artifact: Artifact,
  state: any,
) {
  const stateType = artifact.stateType!
  if (!stateType) {
    return
  }
  const hashedMapFields = HashedMapAbiUtil.findHashedMapFieldsInStateType(artifact);
  hashedMapFields.forEach(field => {
    const hashedMapValue = HashedMapAbiUtil.getFieldValueByPath(state, field) as HashedMap<any, any, any>;
    const isHashedMapField = hashedMapValue instanceof HashedMap;
    if (isHashedMapField) {
      const fieldCtxType = HashedMapAbiUtil.getHashedMapCtxByState(artifact, field).type;
      hashedMapValue.attachTo(fieldCtxType, artifact);
    }
  })
}

export function wrapStateType(artifact: Artifact, state: any) {
  state = cloneDeep(state);
  const stateType = artifact.stateType!
  if (!stateType) {
    return
  }
  const hashedMapFields = HashedMapAbiUtil.findHashedMapFieldsInStateType(artifact);
  hashedMapFields.forEach(field => {
    const hashedMapValue = HashedMapAbiUtil.getFieldValueByPath(state, field) as HashedMap<any, any, any>;
    const isHashedMapField = hashedMapValue instanceof HashedMap;
    if (isHashedMapField) {
      changeFieldValue(field, state, (value) => new TracedHashedMap(value));
    }
  })

  return state;
}

export function wrapParamType(artifact: Artifact, callingMethod: string, param: any, paramIndex: number) {
  param = cloneDeep(param)
  const abi = artifact.abi.find(f => f.name === callingMethod);
  if (!abi) {
    return param;
  }
  const paramType = abi.params[paramIndex].type;
  const struct = artifact.structs.find(f => f.name === paramType);
  if (!struct) {
    return param;
  }
  const abiCoder = new ABICoder(artifact);
  const fields = abiCoder.flattenStruct(param, paramType, true);
  fields.forEach(field => {
    const isHashedMapNameField = field.name.endsWith('._root') && field.type === 'bytes';
    const hashedMapFieldName = field.name.slice('flattened_struct.'.length, -'._root'.length);
    const hashedMapValue = HashedMapAbiUtil.getFieldValueByPath(param, hashedMapFieldName) as HashedMap<any, any, any>;
    const isHashedMapField = isHashedMapNameField && hashedMapValue instanceof HashedMap;
    if (isHashedMapField) {
      changeFieldValue(hashedMapFieldName, param, (value) => new TracedHashedMap(value));
    }
  })
  return param;
}

export function extractHashedMapCtx(artifact: Artifact, baseVariable: any, ctxFieldName: string) {
  const hashedMapFieldPath = ctxFieldName.split(HashedMapAbiUtil.SYMBOLS.SCRYPT_SPLITTERS.DOT).slice(1).join(HashedMapAbiUtil.SYMBOLS.SCRYPT_SPLITTERS.DOT)

  const map = HashedMapAbiUtil.getFieldValueByPath(baseVariable, hashedMapFieldPath) as TracedHashedMap<any, any, any>;

  const { ctx } = map.extractContext();
  verifyHashedMapContext(map)

  return ctx;
}


function changeFieldValue(fieldName: string, state: any, changeFn: (value: any) => any) {
  const value = HashedMapAbiUtil.getFieldValueByPath(state, fieldName);
  const newValue = changeFn(value);
  return HashedMapAbiUtil.setFieldValueByPath(state, fieldName, newValue);
}
