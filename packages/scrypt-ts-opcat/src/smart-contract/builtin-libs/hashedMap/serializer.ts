import { Artifact } from "../../types/artifact.js";
import { PrimitiveTypes, StructObject, SupportedParamType } from "../../types/primitives.js";
import { serializeState } from "../../stateSerializer.js";
import { intToByteString, toByteString } from "../../fns/byteString.js";



// todo support primitive types

export function serializeValue(
    artifact: Artifact,
    valueType: string,
    value: SupportedParamType,
) {
    
    return serializeState(artifact, valueType, value as StructObject, false);
}

export function serializeKey(
    key: PrimitiveTypes,
) {
    switch(typeof key) {
        case 'number':
        case 'bigint':
            return intToByteString(key);
        case 'boolean':
            return key ? '01' : '';
        case 'string':
            return toByteString(key);
    }
    throw new Error(`Unsupported key type: ${typeof key}`);
}