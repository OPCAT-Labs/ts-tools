import {
  arrayTypeAndSize,
  buildScriptHex,
  isArrayType,
  resolveType,
  subArrayType,
  subscript,
} from './abiutils.js';
import {
  ABIEntityType,
  AliasEntity,
  Artifact,
  ContractEntity,
  LibraryEntity,
  ParamEntity,
  StaticEntity,
  StructEntity,
} from './types/artifact.js';
import { toScriptHex } from './serializer.js';
import { SymbolType, TypeInfo, TypeResolver, isScryptType } from './types/abi.js';
import { PrimitiveTypes, StructObject, SupportedParamType } from './types/primitives.js';
import { Script } from './types/script.js';

/**
 * @ignore
 */
export interface Argument {
  name: string;
  type: string;
  value: SupportedParamType;
}

/**
 * @ignore
 */
export type Arguments = Argument[];

/**
 * @ignore
 */
export function buildTypeResolverFromArtifact(artifact: Artifact): TypeResolver {
  const alias: AliasEntity[] = artifact.alias || [];
  const library: LibraryEntity[] = artifact.library || [];
  const structs: StructEntity[] = artifact.structs || [];
  const contract = artifact.contract;
  return buildTypeResolver(contract, alias, structs, library);
}

/**
 * @ignore
 */
export function hasGeneric(entity: StructEntity | LibraryEntity): boolean {
  return entity.genericTypes.length > 0;
}

/**
 * build a resolver which can only resolve type
 * @ignore
 */
export function buildTypeResolver(
  _contract: string,
  _alias: AliasEntity[],
  structs: StructEntity[],
  library: LibraryEntity[],
  contracts: ContractEntity[] = [],
  _statics: StaticEntity[] = [],
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

  resolvedTypes['PubKeyHash'] = {
    finalType: 'Ripemd160',
    generic: false,
    symbolType: SymbolType.ScryptType,
  };

  const resolver = (type: string): TypeInfo => {
    const resolvedType = resolvedTypes[type];
    if (resolvedType) {
      return resolvedType;
    }

    if (isScryptType(type)) {
      return {
        generic: false,
        finalType: type,
        symbolType: SymbolType.ScryptType,
      };
    }

    return resolveType(type, resolvedTypes);
  };

  return resolver;
}

/**
 * @ignore
 */
export class ABICoder {
  readonly artifact: Artifact;

  constructor(artifact: Artifact) {
    this.artifact = artifact;
  }

  encodeConstructorCall(ctorArgs: SupportedParamType[]): Script {
    const constructorABI = this.artifact.abi.filter(
      (entity) => entity.type === ABIEntityType.CONSTRUCTOR,
    )[0];
    const cParams = constructorABI?.params || [];

    const args_ = this.transformerArgs(ctorArgs, cParams);
    const resolver = buildTypeResolverFromArtifact(this.artifact);

    // handle array type
    const flatteredArgs = cParams.flatMap((p, index) => {
      const a = Object.assign(
        { ...p },
        {
          value: args_[index],
        },
      ) as Argument;

      return flatternArg(a, resolver, { state: false, ignoreValue: false });
    });

    const hexTemplateArgs: Map<string, string> = new Map();

    flatteredArgs.forEach((arg) => {
      if (!this.artifact.hex.includes(`<${arg.name}>`)) {
        throw new Error(
          `abi constructor params mismatch with args provided: missing ${arg.name} in ASM tempalte`,
        );
      }
      hexTemplateArgs.set(`<${arg.name}>`, toScriptHex(arg.value as PrimitiveTypes));
    });

    const lockingScriptHex = buildScriptHex(hexTemplateArgs, new Map(), this.artifact.hex);
    return Script.fromHex(lockingScriptHex);
  }

  isPubFunction(method: string): boolean {
    return (
      this.artifact.abi.findIndex(
        (entity) => entity.name === method && entity.type === ABIEntityType.FUNCTION,
      ) > -1
    );
  }

  encodePubFunctionCall(method: string, args: SupportedParamType[]): Script {
    const resolver = buildTypeResolverFromArtifact(this.artifact);
    const methodABI = this.artifact.abi.find(
      (entity) => entity.name === method && entity.type === ABIEntityType.FUNCTION,
    );
    if (!methodABI) {
      throw new Error(
        `no public function named '${method}' found in contract '${this.artifact.contract}'`,
      );
    }

    const args_ = this.transformerArgs(args, methodABI.params);

    const flatteredArgs = methodABI.params.flatMap((p, index) => {
      const a = Object.assign(
        { ...p },
        {
          value: args_[index],
        },
      ) as Argument;

      return flatternArg(a, resolver, { state: false, ignoreValue: false });
    });

    let unlockingScriptHex = flatteredArgs.map((a) => toScriptHex(a.value as PrimitiveTypes)).join('');

    const fns = this.artifact.abi.filter((entity) => entity.type === ABIEntityType.FUNCTION);

    if (fns.length >= 2 && methodABI.index !== undefined) {
      // selector when there are multiple public functions
      const pubFuncIndex = methodABI.index;
      unlockingScriptHex += `${toScriptHex(BigInt(pubFuncIndex))}`;
    }

    return Script.fromHex(unlockingScriptHex);
  }

  flattenStruct(arg: StructObject, type: string, ignoreValue: boolean = false): Arguments {
    const resolver = buildTypeResolverFromArtifact(this.artifact);
    return flatternStruct(
      arg,
      {
        name: 'flattened_struct',
        type,
      },
      resolver,
      { state: false, ignoreValue },
    );
  }

  private transformerArgs(args: SupportedParamType, params: ParamEntity[]): SupportedParamType[] {
    return params.map((p, index) => this.transformerArg(args[index], p));
  }

  private transformerArg(arg: SupportedParamType, param: ParamEntity): SupportedParamType {
    const resolver = buildTypeResolverFromArtifact(this.artifact);

    const typeInfo = resolver(param.type);

    if (isArrayType(typeInfo.finalType)) {
      const [_, arraySizes] = arrayTypeAndSize(typeInfo.finalType);

      if (!Array.isArray(arg)) {
        return arg;
      }

      if (arg.length !== arraySizes[0]) {
        return arg;
      }

      const subType = subArrayType(param.type);

      const results = [] as SupportedParamType[];

      for (let i = 0; i < arraySizes[0]; i++) {
        const elem = arg[i];
        results.push(
          this.transformerArg(elem, {
            name: `${param.name}${subscript(i, arraySizes)}`,
            type: subType,
          }),
        );
      }

      return results;
    } else if (typeInfo.symbolType === SymbolType.Library) {
      const entity: LibraryEntity = typeInfo.info as LibraryEntity;

      return entity.params.map((p, index) => {
        return this.transformerArg(arg[index], p);
      });
    } else if (typeInfo.symbolType === SymbolType.Struct) {
      if (!Array.isArray(arg) && typeof arg === 'object') {
        const entity: StructEntity = typeInfo.info as StructEntity;

        const clone = Object.assign({}, arg);
        entity.params.forEach((property) => {
          if (typeof arg[property.name] !== 'undefined') {
            clone[property.name] = this.transformerArg(arg[property.name], property);
          }
        });

        return clone;
      }
    } else if (typeof arg === 'number') {
      return BigInt(arg);
    }

    return arg;
  }

  /**
   * build a CallData by unlocking script in hex.
   * @param hex hex of unlocking script
   * @returns a CallData which contains the function parameters that have been deserialized
   */
  // parseCallData(hex: string): CallData {

  //   const unlockingScript = bsv.Script.fromHex(hex);

  //   const usASM = unlockingScript.toASM() as string;

  //   const pubFunAbis = this.abi.filter(entity => entity.type === 'function');
  //   const pubFunCount = pubFunAbis.length;

  //   let entity: ABIEntity | undefined = undefined;
  //   if (pubFunCount === 1) {
  //     entity = pubFunAbis[0];
  //   } else {

  //     const pubFuncIndexASM = usASM.slice(usASM.lastIndexOf(' ') + 1);

  //     const pubFuncIndex = asm2int(pubFuncIndexASM);

  //     entity = this.abi.find(entity => entity.index === pubFuncIndex);
  //   }

  //   if (!entity) {
  //     throw new Error(`the raw unlocking script cannot match the contract ${this.constructor.name}`);
  //   }

  //   const cParams = entity.params || [];

  //   const dummyArgs = cParams.map(p => {
  //     const dummyArg = Object.assign({}, p, { value: false });
  //     return flatternArg(dummyArg, this.resolver, { state: true, ignoreValue: true });
  //   }).flat(Infinity) as Arguments;

  //   let fArgsLen = dummyArgs.length;
  //   if (this.abi.length > 2 && entity.index !== undefined) {
  //     fArgsLen += 1;
  //   }

  //   const asmOpcodes = usASM.split(' ');

  //   if (fArgsLen != asmOpcodes.length) {
  //     throw new Error(`the raw unlockingScript cannot match the arguments of public function ${entity.name} of contract ${this.contractName}`);
  //   }

  //   const hexTemplateArgs: Map<string, string> = new Map();

  //   dummyArgs.forEach((farg: Argument, index: number) => {

  //     hexTemplateArgs.set(`<${farg.name}>`, bsv.Script.fromASM(asmOpcodes[index]).toHex());

  //   });

  //   const args: Arguments = cParams.map(param => deserializeArgfromHex(this.resolver, Object.assign(param, {
  //     value: false //fake value
  //   }), hexTemplateArgs, { state: false }));

  //   return {
  //     methodName: entity.name,
  //     args,
  //     unlockingScript
  //   };

  // }
}

function flatternArray(
  arg: SupportedParamType[],
  param: ParamEntity,
  resolver: TypeResolver,
  options: FlatOptions,
): Arguments {
  const [elemTypeName, arraySizes] = arrayTypeAndSize(param.type);

  const typeInfo = resolver(elemTypeName);

  if (!options.ignoreValue) {
    if (!Array.isArray(arg)) {
      throw new Error('flatternArray only work with array');
    }

    if (arg.length != arraySizes[0]) {
      throw new Error(`Array length not match, expected ${arraySizes[0]} but got ${arg.length}`);
    }
  }

  return new Array(arraySizes[0]).fill(1).flatMap((_, index) => {
    const item = options.ignoreValue ? undefined : arg[index];
    if (arraySizes.length > 1) {
      return flatternArg(
        {
          name: `${param.name}[${index}]`,
          type: subArrayType(param.type),
          value: item,
        },
        resolver,
        options,
      );
    } else if (typeInfo.symbolType === SymbolType.Struct) {
      return flatternArg(
        {
          name: `${param.name}[${index}]`,
          type: elemTypeName,
          value: item,
        },
        resolver,
        options,
      );
    } else if (typeInfo.symbolType === SymbolType.Library) {
      return flatternArg(
        {
          name: `${param.name}[${index}]`,
          type: elemTypeName,
          value: item,
        },
        resolver,
        options,
      );
    }

    return {
      value: item,
      name: `${param.name}${subscript(index, arraySizes)}`,
      type: elemTypeName,
    };
  });
}

function flatternStruct(
  arg: StructObject,
  param: ParamEntity,
  resolver: TypeResolver,
  options: FlatOptions,
): Arguments {
  const typeInfo = resolver(param.type);

  if (!options.ignoreValue) {
    if (arg === undefined) {
      throw new Error(`the arg value of ${param.name} for flatternStruct is undefined`);
    }

    if (typeof arg !== 'object') {
      throw new Error(`flatternStruct only works with object but not ${typeof arg}`);
    }
  }

  const entity = typeInfo.info as StructEntity;

  if (typeInfo.generic) {
    throw new Error('no support generic');
  }

  return entity.params.flatMap((p) => {
    const paramTypeInfo = resolver(p.type);

    const member = options.ignoreValue ? undefined : arg[p.name];
    if (isArrayType(paramTypeInfo.finalType)) {
      return flatternArg(
        {
          name: `${param.name}.${p.name}`,
          type: p.type,
          value: member,
        },
        resolver,
        options,
      );
    } else if (paramTypeInfo.symbolType === SymbolType.Struct) {
      return flatternArg(
        {
          name: `${param.name}.${p.name}`,
          type: p.type,
          value: member,
        },
        resolver,
        options,
      );
    } else {
      return {
        value: member,
        name: `${param.name}.${p.name}`,
        type: p.type,
      };
    }
  });
}

function flatternLibrary(
  args: SupportedParamType,
  param: ParamEntity,
  resolver: TypeResolver,
  options: FlatOptions,
): Arguments {
  const typeInfo = resolver(param.type);

  const entity = typeInfo.info as LibraryEntity;

  if (typeInfo.generic) {
    throw new Error('no support generic');
  }

  if (!options.ignoreValue) {
    if (options.state) {
      if (typeof args !== 'object') {
        throw new Error('only work with object when flat a libray as state');
      }
    } else {
      if (!Array.isArray(args)) {
        throw new Error('only work with array when flat a library');
      }

      if (entity.params.length != args.length) {
        throw new Error(
          `Array length not match, expected ${entity.params.length} but got ${args.length}`,
        );
      }
    }
  }

  const toflat = options.state ? entity.properties : entity.params;

  return toflat.flatMap((p, index) => {
    const paramTypeInfo = resolver(p.type);
    let arg = options.ignoreValue ? undefined : options.state ? args[p.name] : args[index];

    if (
      !options.ignoreValue &&
      typeof arg === 'undefined' &&
      (entity.name === 'HashedSet' || entity.name === 'HashedMap')
    ) {
      arg = args[0];
    }

    if (isArrayType(paramTypeInfo.finalType)) {
      return flatternArg(
        {
          name: `${param.name}.${p.name}`,
          type: p.type,
          value: arg,
        },
        resolver,
        options,
      );
    } else if (paramTypeInfo.symbolType === SymbolType.Struct) {
      return flatternArg(
        {
          name: `${param.name}.${p.name}`,
          type: p.type,
          value: arg,
        },
        resolver,
        options,
      );
    } else if (paramTypeInfo.symbolType === SymbolType.Library) {
      return flatternArg(
        {
          name: `${param.name}.${p.name}`,
          type: p.type,
          value: arg,
        },
        resolver,
        options,
      );
    } else {
      return {
        value: arg,
        name: `${param.name}.${p.name}`,
        type: p.type,
      };
    }
  });
}

type FlatOptions = {
  state: boolean;
  ignoreValue: boolean;
};

function flatternArg(arg: Argument, resolver: TypeResolver, options: FlatOptions): Arguments {
  const args_: Arguments = [];

  const typeInfo = resolver(arg.type);
  if (isArrayType(typeInfo.finalType)) {
    flatternArray(
      options.ignoreValue ? undefined : (arg.value as SupportedParamType[]),
      {
        name: arg.name,
        type: typeInfo.finalType,
      },
      resolver,
      options,
    ).forEach((e) => {
      args_.push({
        name: e.name,
        type: resolver(e.type).finalType,
        value: e.value,
      });
    });
  } else if (typeInfo.symbolType === SymbolType.Struct) {
    flatternStruct(
      arg.value as StructObject,
      {
        name: arg.name,
        type: typeInfo.finalType,
      },
      resolver,
      options,
    ).forEach((e) => {
      args_.push({
        name: e.name,
        type: resolver(e.type).finalType,
        value: e.value,
      });
    });
  } else if (typeInfo.symbolType === SymbolType.Library) {
    flatternLibrary(
      arg.value as SupportedParamType[],
      {
        name: arg.name,
        type: typeInfo.finalType,
      },
      resolver,
      options,
    ).forEach((e) => {
      args_.push({
        name: e.name,
        type: resolver(e.type).finalType,
        value: e.value,
      });
    });
  } else {
    args_.push({
      name: arg.name,
      type: typeInfo.finalType,
      value: arg.value,
    });
  }

  return args_;
}
