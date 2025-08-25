import {
  AliasEntity,
  ContractEntity,
  isScryptType,
  LibraryEntity,
  StaticEntity,
  StructEntity,
  SymbolType,
  TypeInfo,
  TypeResolver,
} from '@opcat-labs/scrypt-ts';

// build a resolver witch can only resolve type
export function buildTypeResolver(
  contract: string,
  alias: AliasEntity[],
  structs: StructEntity[],
  library: LibraryEntity[],
  contracts: ContractEntity[] = [],
  statics: StaticEntity[] = [],
): TypeResolver {
  const resolvedTypes: Record<string, TypeInfo> = {};
  structs.forEach((element) => {
    resolvedTypes[element.name] = {
      info: element,
      generic: hasGeneric(element),
      finalType: element.name,
      symbolType: SymbolType.Struct,
    };
  });

  library.forEach((element) => {
    resolvedTypes[element.name] = {
      info: element,
      generic: hasGeneric(element),
      finalType: element.name,
      symbolType: SymbolType.Library,
    };
  });

  contracts.forEach((element) => {
    resolvedTypes[element.name] = {
      info: element,
      generic: hasGeneric(element),
      finalType: element.name,
      symbolType: SymbolType.Contract,
    };
  });

  // add std type

  resolvedTypes['HashedMap'] = {
    info: {
      name: 'HashedMap',
      params: [
        {
          name: '_data',
          type: 'bytes',
        },
      ],
      properties: [
        {
          name: '_data',
          type: 'bytes',
        },
      ],
      genericTypes: ['K', 'V'],
    },
    generic: true,
    finalType: 'HashedMap',
    symbolType: SymbolType.Library,
  };
  resolvedTypes['HashedSet'] = {
    info: {
      name: 'HashedSet',
      params: [
        {
          name: '_data',
          type: 'bytes',
        },
      ],
      properties: [
        {
          name: '_data',
          type: 'bytes',
        },
      ],
      genericTypes: ['E'],
    },
    generic: true,
    finalType: 'HashedSet',
    symbolType: SymbolType.Library,
  };

  resolvedTypes['SortedItem'] = {
    info: {
      name: 'SortedItem',
      params: [
        {
          name: 'item',
          type: 'T',
        },
        {
          name: 'idx',
          type: 'int',
        },
      ],
      genericTypes: ['T'],
    },
    generic: true,
    finalType: 'SortedItem',
    symbolType: SymbolType.Struct,
  };

  resolvedTypes['PubKeyHash'] = {
    finalType: 'Ripemd160',
    generic: false,
    symbolType: SymbolType.ScryptType,
  };

  const resolver = (type: string): TypeInfo => {
    if (resolvedTypes[type]) {
      return resolvedTypes[type];
    }

    if (isScryptType(type)) {
      return {
        generic: false,
        finalType: type,
        symbolType: SymbolType.ScryptType,
      };
    }

    return resolveType(type, resolvedTypes, contract, statics, alias, library);
  };

  return resolver;
}

function resolveAlias(alias: AliasEntity[], type: string): string {
  const a = alias.find((a) => {
    return a.name === type;
  });

  if (a) {
    return resolveAlias(alias, a.type);
  }
  return type;
}

function isArrayType(type: string): boolean {
  return /^(.+)(\[[\w.]+\])+$/.test(type);
}

/**
 * return eg. int[N][N][4] => ['int', ["N","N","4"]]
 * @param arrayTypeName
 */
function arrayTypeAndSizeStr(arrayTypeName: string): [string, Array<string>] {
  const arraySizes: Array<string> = [];

  if (arrayTypeName.indexOf('>') > -1) {
    const elemTypeName = arrayTypeName.substring(0, arrayTypeName.lastIndexOf('>') + 1);
    const sizeParts = arrayTypeName.substring(arrayTypeName.lastIndexOf('>') + 1);

    [...sizeParts.matchAll(/\[([\w.]+)\]+/g)].map((match) => {
      arraySizes.push(match[1]);
    });

    return [elemTypeName, arraySizes];
  }
  [...arrayTypeName.matchAll(/\[([\w.]+)\]+/g)].map((match) => {
    arraySizes.push(match[1]);
  });

  const group = arrayTypeName.split('[');
  const elemTypeName = group[0];
  return [elemTypeName, arraySizes];
}

function toLiteralArrayType(elemTypeName: string, sizes: Array<number | string>): string {
  return [elemTypeName, sizes.map((size) => `[${size}]`).join('')].join('');
}

/**
 * check if a type is generic type
 * @param type
 * @returns
 */
function isGenericType(type: string): boolean {
  return /^([\w]+)<([\w,[\]\s<>]+)>$/.test(type);
}

/**
 *
 * @param type eg. HashedMap<int,int>
 * @param eg. ["HashedMap", ["int", "int"]}] An array generic types returned by @getGenericDeclaration
 * @returns {"K": "int", "V": "int"}
 */
function parseGenericType(type: string): [string, Array<string>] {
  if (isGenericType(type)) {
    const m = type.match(/([\w]+)<([\w,[\]<>\s]+)>$/);
    if (m) {
      const library = m[1];
      const realTypes = [];
      const brackets = [];
      let tmpType = '';
      for (let i = 0; i < m[2].length; i++) {
        const ch = m[2].charAt(i);

        if (ch === '<' || ch === '[') {
          brackets.push(ch);
        } else if (ch === '>' || ch === ']') {
          brackets.pop();
        } else if (ch === ',') {
          if (brackets.length === 0) {
            realTypes.push(tmpType.trim());
            tmpType = '';
            continue;
          }
        }
        tmpType += ch;
      }
      realTypes.push(tmpType.trim());

      return [library, realTypes];
    }
  }
  throw new Error(`"${type}" is not generic type`);
}

function resolveConstStatic(contract: string, type: string, statics: StaticEntity[]): string {
  if (isArrayType(type)) {
    const [elemTypeName, arraySizes] = arrayTypeAndSizeStr(type);

    const sizes = arraySizes.map((size) => {
      if (/^(\d)+$/.test(size)) {
        return parseInt(size);
      } else {
        // size as a static const
        const size_ = size.indexOf('.') > 0 ? size : `${contract}.${size}`;
        const value = findConstStatic(statics, size_);
        if (!value) {
          // Unable to solve when the subscript of the array is a function parameter, [CTC](https://scryptdoc.readthedocs.io/en/latest/ctc.html)
          return size;
        }
        return value.value;
      }
    });

    return toLiteralArrayType(elemTypeName, sizes);
  }
  return type;
}

function toGenericType(name: string, genericTypes: Array<string>): string {
  return `${name}<${genericTypes.join(',')}>`;
}

function findConstStatic(statics: StaticEntity[], name: string): StaticEntity | undefined {
  return statics.find((s) => {
    return s.const === true && s.name === name;
  });
}

function resolveType(
  type: string,
  originTypes: Record<string, TypeInfo>,
  contract: string,
  statics: StaticEntity[],
  alias: AliasEntity[],
  librarys: LibraryEntity[],
): TypeInfo {
  type = resolveAlias(alias, type);

  if (isArrayType(type)) {
    const [elemTypeName, sizes] = arrayTypeAndSizeStr(type);
    const elemTypeInfo = resolveType(elemTypeName, originTypes, contract, statics, alias, librarys);

    if (isArrayType(elemTypeInfo.finalType)) {
      const [elemTypeName_, sizes_] = arrayTypeAndSizeStr(elemTypeInfo.finalType);

      const elemTypeInfo_ = resolveType(
        elemTypeName_,
        originTypes,
        contract,
        statics,
        alias,
        librarys,
      );
      return {
        info: elemTypeInfo.info,
        generic: elemTypeInfo.generic,
        finalType: resolveConstStatic(
          contract,
          toLiteralArrayType(elemTypeInfo_.finalType, sizes.concat(sizes_)),
          statics,
        ),
        symbolType: elemTypeInfo.symbolType,
      };
    }

    return {
      info: elemTypeInfo.info,
      generic: elemTypeInfo.generic,
      finalType: resolveConstStatic(
        contract,
        toLiteralArrayType(elemTypeInfo.finalType, sizes),
        statics,
      ),
      symbolType: elemTypeInfo.symbolType,
    };
  } else if (isGenericType(type)) {
    const [name, genericTypes] = parseGenericType(type);
    const typeInfo = resolveType(name, originTypes, contract, statics, alias, librarys);
    const gts = genericTypes.map(
      (t) => resolveType(t, originTypes, contract, statics, alias, librarys).finalType,
    );

    return {
      info: typeInfo.info,
      generic: true,
      finalType: toGenericType(typeInfo.finalType, gts),
      symbolType: typeInfo.symbolType,
    };
  }

  if (originTypes[type]) {
    return originTypes[type];
  } else if (isScryptType(type)) {
    return {
      finalType: type,
      generic: false,
      symbolType: SymbolType.ScryptType,
    };
  } else {
    return {
      finalType: type,
      generic: false,
      symbolType: SymbolType.Unknown,
    };
  }
}

function hasGeneric(entity: StructEntity | LibraryEntity): boolean {
  return entity.genericTypes.length > 0;
}
