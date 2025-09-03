import { ABICoder } from "../../abi.js";
import { getUnRenamedSymbol } from "../../abiutils.js";
import { Artifact } from "../../types/artifact.js";
import { HashedMap } from "./hashedMap.js";
import { cloneDeep } from "../../../utils/common.js";
import { TracedHashedMap } from "./tracedHashedMap.js";

export function attachToStateType(
  artifact: Artifact,
  state: any,
) {
  const stateType = artifact.stateType!
  if (!stateType) {
    return
  }
  const abiCoder = new ABICoder(artifact);
  const fields = abiCoder.flattenStruct(state, stateType, true);
  fields.forEach(field => {
    const fieldType = getUnRenamedSymbol(field.type);
    const isHashedMapNameField = field.name.endsWith('._root') && field.type === 'bytes';
    const hashedMapFieldName = field.name.slice('flattened_struct.'.length, -'._root'.length);
    const hashedMapValue = getFieldValue(hashedMapFieldName, state) as HashedMap<any, any, any>;
    const isHashedMapField = isHashedMapNameField && hashedMapValue instanceof HashedMap;

    if (isHashedMapField) {
      // this is the hashed map field
      const fieldCtxType = findCtxType(artifact, hashedMapFieldName);
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
  const abiCoder = new ABICoder(artifact);
  const fields = abiCoder.flattenStruct(state, stateType, true);
  fields.forEach(field => {
    const isHashedMapNameField = field.name.endsWith('._root') && field.type === 'bytes';
    const hashedMapFieldName = field.name.slice('flattened_struct.'.length, -'._root'.length);
    const hashedMapValue = getFieldValue(hashedMapFieldName, state) as HashedMap<any, any, any>;
    const isHashedMapField = isHashedMapNameField && hashedMapValue instanceof HashedMap;

    if (isHashedMapField) {
      changeFieldValue(hashedMapFieldName, state, (value) => new TracedHashedMap(value));
    }
  })
  return state;
}

export function extractHashedMapCtx(artifact: Artifact, state: any, ctxFeildName: string) {
  const statePaths = ctxFeildName.slice('__scrypt_ts_nextState__dot__'.length).slice(0, -('__ctx'.length)).replaceAll('__dot__', '.');

  const map = getFieldValue(statePaths, state) as TracedHashedMap<any, any, any>;
  return map.extractContext();
}

// todo: support array
function getFieldValue(fieldName: string, state: any) {
  const fields = fieldName.split('.');
  let cur = state;
  for (const field of fields) {
    cur = cur[field];
  }
  return cur;
}

function changeFieldValue(fieldName: string, state: any, changeFn: (value: any) => any) {
  const value = changeFn(getFieldValue(fieldName, state));
  const fields = fieldName.split('.');
  const prefix = fields.slice(0, -1)
  const last = fields[fields.length - 1];
  let cur = state;
  for (const field of prefix) {
    cur = cur[field];
  }
  cur[last] = value;
  return state;
}

function findCtxType(artifact: Artifact, fieldName: string) {
  const ctxFieldName = `__scrypt_ts_nextState__dot__${fieldName.replaceAll('.', '__dot__')}__ctx`;
  const param = artifact.abi.map(v => v.params).flat().find(p => p.name === ctxFieldName);
  if (!param) {
    throw new Error(`Context type ${ctxFieldName} not found in artifact`);
  }
  return param.type;
}
