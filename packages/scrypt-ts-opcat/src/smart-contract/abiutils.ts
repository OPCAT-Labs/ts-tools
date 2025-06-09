import { isScryptType, SymbolType, TypeInfo } from './types/abi.js';

export function isArrayType(type: string): boolean {
  return /^(.+)(\[[\w.]+\])+$/.test(type);
}

/**
 * return eg. int[2][3][4] => ['int', [2,3,4]]
 * @ignore
 * @param arrayTypeName  eg. int[2][3][4]
 */
export function arrayTypeAndSize(arrayTypeName: string): [string, Array<number>] {
  const [elemTypeName, arraySizes] = arrayTypeAndSizeStr(arrayTypeName);
  return [
    elemTypeName,
    arraySizes.map((size) => {
      const n = parseInt(size);

      if (isNaN(n)) {
        throw new Error(`arrayTypeAndSize error type ${arrayTypeName} with sub isNaN`);
      }

      return n;
    }),
  ];
}

/**
 * return eg. int[N][N][4] => ['int', ["N","N","4"]]
 * @ignore
 * @param arrayTypeName
 */
export function arrayTypeAndSizeStr(arrayTypeName: string): [string, Array<string>] {
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

/**
 * return eg. int[2][3][4] => int[3][4]
 * @ignore
 * @param arrayTypeName  eg. int[2][3][4]
 */
export function subArrayType(arrayTypeName: string): string {
  const [elemTypeName, sizes] = arrayTypeAndSize(arrayTypeName);
  return toLiteralArrayType(elemTypeName, sizes.slice(1));
}

/**
 * @ignore
 * @param elemTypeName
 * @param sizes
 * @returns
 */
export function toLiteralArrayType(elemTypeName: string, sizes: Array<number | string>): string {
  return [elemTypeName, sizes.map((size) => `[${size}]`).join('')].join('');
}

/**
 * @ignore
 * @param index
 * @param arraySizes
 * @returns
 */
export function subscript(index: number, arraySizes: Array<number>): string {
  if (arraySizes.length == 1) {
    return `[${index}]`;
  } else {
    const subArraySizes = arraySizes.slice(1);
    const offset = subArraySizes.reduce(function (acc, val) {
      return acc * val;
    }, 1);
    return `[${Math.floor(index / offset)}]${subscript(index % offset, subArraySizes)}`;
  }
}

function escapeRegExp(stringToGoIntoTheRegex: string) {
  return stringToGoIntoTheRegex.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * @ignore
 * @param hexTemplateArgs
 * @param hexTemplateInlineASM
 * @param hexTemplate
 * @returns
 */
export function buildScriptHex(
  hexTemplateArgs: Map<string, string>,
  hexTemplateInlineASM: Map<string, string>,
  hexTemplate: string,
): string {
  let lsHex = hexTemplate;
  for (const entry of hexTemplateArgs.entries()) {
    const name = entry[0];
    const value = entry[1];
    lsHex = lsHex.replace(name, value);
  }

  for (const entry of hexTemplateInlineASM.entries()) {
    const name = entry[0];
    const value = entry[1];
    lsHex = lsHex.replace(new RegExp(`${escapeRegExp(name)}`, 'g'), value);
  }

  return lsHex;
}

/**
 * @ignore
 * @param type
 * @param originTypes
 * @returns
 */
export function resolveType(type: string, originTypes: Record<string, TypeInfo>): TypeInfo {
  if (isArrayType(type)) {
    const [elemTypeName, sizes] = arrayTypeAndSizeStr(type);
    const elemTypeInfo = resolveType(elemTypeName, originTypes);

    if (isArrayType(elemTypeInfo.finalType)) {
      const [elemTypeName_, sizes_] = arrayTypeAndSizeStr(elemTypeInfo.finalType);

      const elemTypeInfo_ = resolveType(elemTypeName_, originTypes);
      return {
        info: elemTypeInfo.info,
        generic: elemTypeInfo.generic,
        finalType: resolveConstStatic(
          toLiteralArrayType(elemTypeInfo_.finalType, sizes.concat(sizes_)),
        ),
        symbolType: elemTypeInfo.symbolType,
      };
    }

    return {
      info: elemTypeInfo.info,
      generic: elemTypeInfo.generic,
      finalType: resolveConstStatic(toLiteralArrayType(elemTypeInfo.finalType, sizes)),
      symbolType: elemTypeInfo.symbolType,
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

function resolveConstStatic(type: string): string {
  if (isArrayType(type)) {
    const [elemTypeName, arraySizes] = arrayTypeAndSizeStr(type);

    const sizes = arraySizes.map((size) => {
      if (/^(\d)+$/.test(size)) {
        return parseInt(size);
      } else {
        // size as a static const
        throw new Error('should not reach here!');
      }
    });
    return toLiteralArrayType(elemTypeName, sizes);
  }
  return type;
}

export function getUnRenamedSymbol(symbol: string) {
    const RENAME_SYMBOL_SEP = '__rs__';
    const parts = symbol.split(RENAME_SYMBOL_SEP);
    return parts[parts.length - 1];
  }