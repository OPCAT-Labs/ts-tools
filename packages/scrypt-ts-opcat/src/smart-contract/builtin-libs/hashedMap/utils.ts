import { ABICoder } from "../../abi.js";
import { getUnRenamedSymbol } from "../../abiutils.js";
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
  const hashedMapFieldPath = ctxFieldName.split('__dot__').slice(1).join('__dot__')

  const map = HashedMapAbiUtil.getFieldValueByPath(baseVariable, hashedMapFieldPath) as TracedHashedMap<any, any, any>;

  const { ctx } = map.extractContext();
  verifyHashedMapContext(map)

  return ctx;
}


function changeFieldValue(fieldName: string, state: any, changeFn: (value: any) => any) {
  const value = changeFn(HashedMapAbiUtil.getFieldValueByPath(state, fieldName));
  const fields = parseField(fieldName);
  const prefix = fields.slice(0, -1)
  const last = fields[fields.length - 1];
  let cur = state;
  for (const field of prefix) {
    cur = cur[field.value];
  }
  cur[last.value] = value;
  return state;
}

function parseField(f: string) {
  f = f.replaceAll('__dot__', '.').replaceAll('__brl__', '[').replaceAll('__brr__', ']')
  const result: ({ type: 'dot', value: string } | { type: 'array', value: number })[] = [];
  const regex = /(\w+)|\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(f)) !== null) {
    if (match[1]) {
      result.push({ type: 'dot', value: match[1] });
    } else if (match[2]) {
      result.push({ type: 'array', value: parseInt(match[2], 10) });
    }
  }

  return result;
}
