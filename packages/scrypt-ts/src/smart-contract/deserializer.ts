import { arrayTypeAndSize, isArrayType } from './abiutils.js';
import { byteStringToInt } from './fns/byteString.js';
import { isBytes, ScryptType, SymbolType, TypeResolver, Argument } from './types/abi.js';
import { LibraryEntity, ParamEntity, StructEntity } from './types/artifact.js';
import { ByteString, StructObject, SupportedParamType } from './types/primitives.js';
import { Script } from './types/script.js';


export function hex2int(hex: string): bigint {
  if (hex === '00') {
    return BigInt(0);
  } else if (hex === '4f') {
    return BigInt(-1);
  } else {
    const b = Script.fromHex(hex);
    const chuck = b.chunks[0];

    if (chuck.opcodenum >= 81 && chuck.opcodenum <= 96) {
      return BigInt(chuck.opcodenum - 80);
    }
    return byteStringToInt(chuck.buf.toString('hex'));
  }
}

export function hex2bool(hex: string): boolean {
  if (hex === '51') {
    return true;
  } else if (hex === '00') {
    return false;
  }
  throw new Error(`invalid hex ${hex}`);
}



export function hex2bytes(hex: string): ByteString {
  if (hex === '00') {
    return '';
  }

  const s = Script.fromHex(hex);
  const chuck = s.chunks[0];

  if (chuck.opcodenum >= 81 && chuck.opcodenum <= 96) {
    return Buffer.from([chuck.opcodenum - 80]).toString('hex');
  }

  return chuck.buf.toString('hex');
}


function deserializer(type: string, hex: string): SupportedParamType {
  switch (type) {
    case ScryptType.BOOL:
      return hex2bool(hex)
    case ScryptType.INT:
    case ScryptType.PRIVKEY:
      return BigInt(hex2int(hex));
    // case ScryptType.SIGHASHTYPE:
    //   return Number(hex2int(hex)) as SigHashType;
    default:
      if (isBytes(type)) {
        return hex2bytes(hex);
      }
      throw new Error(`<${type}> cannot be cast to ScryptType, only sCrypt native types supported`);
  }
}



function createStruct(resolver: TypeResolver, param: ParamEntity, opcodesMap: Map<string, string>): StructObject {

  const structTypeInfo = resolver(param.type);
  const entity = structTypeInfo.info as StructEntity;

  const obj = Object.create({});
  entity.params.forEach(p => {
    const typeInfo = resolver(p.type);
    if (isArrayType(typeInfo.finalType)) {
      Object.assign(obj, {
        [p.name]: createArray(resolver, typeInfo.finalType, `${param.name}.${p.name}`, opcodesMap)
      });
    } else if (typeInfo.symbolType === SymbolType.Struct) {
      Object.assign(obj, {
        [p.name]: createStruct(resolver, { name: `${param.name}.${p.name}`, type: p.type }, opcodesMap)
      });
    } else if (typeInfo.symbolType === SymbolType.Library) {
      Object.assign(obj, {
        [p.name]: createLibrary(resolver, { name: `${param.name}.${p.name}`, type: p.type }, opcodesMap)
      });
    } else {
      Object.assign(obj, {
        [p.name]: deserializer(typeInfo.finalType, opcodesMap.get(`<${param.name}.${p.name}>`))
      });
    }
  });
  return obj;
}



function createLibrary(resolver: TypeResolver, param: ParamEntity, opcodesMap: Map<string, string>): Array<SupportedParamType> | Record<string, SupportedParamType> {
  const libraryTypeInfo = resolver(param.type);
  const entity = libraryTypeInfo.info as LibraryEntity;

    return entity.params.map(p => {

      const typeInfo = resolver(p.type);

      if (isArrayType(typeInfo.finalType)) {

        return createArray(resolver, typeInfo.finalType, `${param.name}.${p.name}`, opcodesMap);

      } else if (typeInfo.symbolType === SymbolType.Struct) {

        return createStruct(resolver, { name: `${param.name}.${p.name}`, type: p.type }, opcodesMap);

      } else if (typeInfo.symbolType === SymbolType.Library) {

        return createLibrary(resolver, { name: `${param.name}.${p.name}`, type: p.type }, opcodesMap);

      } else {
        return deserializer(typeInfo.finalType, opcodesMap.get(`<${param.name}.${p.name}>`));
      }
    });
}


function createArray(resolver: TypeResolver, type: string, name: string, opcodesMap: Map<string, string>): SupportedParamType {

  const arrays: SupportedParamType[] = [];
  const [elemTypeName, sizes] = arrayTypeAndSize(type);

  const arraylen = sizes[0];
  if (sizes.length === 1) {
    for (let index = 0; index < arraylen; index++) {
      const typeInfo = resolver(elemTypeName);

      if (typeInfo.symbolType === SymbolType.Struct) {
        arrays.push(createStruct(resolver, {
          name: `${name}[${index}]`,
          type: typeInfo.finalType
        }, opcodesMap));
      } else if (typeInfo.symbolType === SymbolType.Library) {
        arrays.push(createLibrary(resolver, {
          name: `${name}[${index}]`,
          type: typeInfo.finalType
        }, opcodesMap));
      }
      else {
        arrays.push(deserializer(typeInfo.finalType, opcodesMap.get(`<${name}[${index}]>`)));
      }

    }

  } else {

    for (let index = 0; index < arraylen; index++) {
      const finalType = resolver(elemTypeName).finalType;
      const subArrayType = [finalType, sizes.slice(1).map(size => `[${size}]`).join('')].join('');
      arrays.push(createArray(resolver, subArrayType, `${name}[${index}]`, opcodesMap));
    }
  }

  return arrays;
}

export function deserializeArgfromHex(
  resolver: TypeResolver, 
  arg: Argument, 
  opcodesMap: Map<string, string>
): Argument {

  let value;

  const typeInfo = resolver(arg.type);

  if (isArrayType(typeInfo.finalType)) {
    value = createArray(resolver, arg.type, arg.name, opcodesMap);
  } else if (typeInfo.symbolType === SymbolType.Struct) {
    value = createStruct(resolver, arg, opcodesMap);
  } else if (typeInfo.symbolType === SymbolType.Library) {
    value = createLibrary(resolver, arg, opcodesMap);
  } else {
    value = deserializer(arg.type, opcodesMap.get(`<${arg.name}>`));
  }

  arg.value = value;
  return arg;
}


