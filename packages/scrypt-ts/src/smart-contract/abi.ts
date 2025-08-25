import {
  arrayTypeAndSize,
  buildScriptHex,
  isArrayType,
  resolveType,
  subArrayType,
  subscript,
} from './abiutils.js';
import {
  ABIEntity,
  ABIEntityType,
  AliasEntity,
  Artifact,
  ContractEntity,
  LibraryEntity,
  ParamEntity,
  StaticEntity,
  StructEntity,
} from './types/artifact.js';
import { serializeArgToHex } from './serializer.js';
import { Argument, Arguments, SymbolType, TypeInfo, TypeResolver, isScryptType } from './types/abi.js';
import { PrimitiveTypes, StructObject, SupportedParamType } from './types/primitives.js';
import { Script } from './types/script.js';
import { uint8ArrayToHex } from '../utils/common.js';
import { deserializeArgfromHex, hex2int } from './deserializer.js';

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
 * ABI encoding and decoding utility for smart contracts.
 * @ignore
 * This class provides methods to:
 * - Encode constructor calls and public function calls into scripts
 * - Decode public function calls from unlocking scripts
 * - Check if a method is a public function
 * - Handle various parameter types including arrays, structs, and libraries
 * - Validate arguments against contract ABI definitions
 * 
 * The coder uses the contract's artifact which contains the ABI and hex template
 * to properly encode and decode contract interactions.
 */
export class ABICoder {
  readonly artifact: Artifact;

  constructor(artifact: Artifact) {
    this.artifact = artifact;
  }

  /**
   * Encodes constructor arguments into a script using the contract's ABI.
   * Validates that all required parameters are present in the ASM template.
   * 
   * @param ctorArgs - Array of constructor arguments to encode
   * @returns Script containing the encoded constructor call
   * @throws Error if any required parameter is missing from the ASM template
   */
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
      hexTemplateArgs.set(`<${arg.name}>`, serializeArgToHex(arg.value as PrimitiveTypes));
    });

    const lockingScriptHex = buildScriptHex(hexTemplateArgs, new Map(), this.artifact.hex);
    return Script.fromHex(lockingScriptHex);
  }

  /**
   * Checks if the given method name is a public function in the contract's ABI.
   * @param method - The name of the method to check.
   * @returns True if the method exists as a public function in the ABI, false otherwise.
   */
  isPubFunction(method: string): boolean {
    return (
      this.artifact.abi.findIndex(
        (entity) => entity.name === method && entity.type === ABIEntityType.FUNCTION,
      ) > -1
    );
  }

  /**
   * Encodes a public function call into a script by flattening and serializing the arguments.
   * 
   * @param method - The name of the public function to call.
   * @param args - The arguments to pass to the function.
   * @returns A script containing the encoded function call.
   * @throws Error if the specified public function is not found in the contract ABI.
   */
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

    let unlockingScriptHex = flatteredArgs.map((a) => serializeArgToHex(a.value as PrimitiveTypes)).join('');

    const fns = this.artifact.abi.filter((entity) => entity.type === ABIEntityType.FUNCTION);

    if (fns.length >= 2 && methodABI.index !== undefined) {
      // selector when there are multiple public functions
      const pubFuncIndex = methodABI.index;
      unlockingScriptHex += `${serializeArgToHex(BigInt(pubFuncIndex))}`;
    }

    return Script.fromHex(unlockingScriptHex);
  }

  /**
   * Decodes a public function call from an unlocking script.
   * 
   * @param unlockingScript - The unlocking script to decode, which can be provided as a Script object, Uint8Array, or hex string.
   * @returns An object containing the decoded method name and arguments.
   * @throws {Error} If no public function is found in the contract, or if the unlocking script doesn't match the contract's ABI.
   * 
   * The function handles both single-function contracts and contracts with multiple public functions.
   * For multi-function contracts, it extracts the function index from the unlocking script ASM.
   * Validates argument count and decodes each argument using the contract's type resolver.
   */
  decodePubFunctionCall(unlockingScript: Script | Uint8Array | string) {
    let unlockingScriptHex: string;
    if (typeof unlockingScript === 'string') {
      unlockingScriptHex = unlockingScript;
    } else if (unlockingScript instanceof Uint8Array) {
      unlockingScriptHex = uint8ArrayToHex(unlockingScript);
    } else {
      unlockingScriptHex = unlockingScript.toHex();
    }

    const usASM = Script.fromHex(unlockingScriptHex).toASM()

    const pubFunAbis = this.artifact.abi.filter(entity => entity.type === ABIEntityType.FUNCTION);
    const pubFunCount = pubFunAbis.length;

    if (pubFunCount === 0) {
      throw new Error(`no public function found in contract: ${this.artifact.contract}`);
    }

    let entity: ABIEntity | undefined = undefined;
    if (pubFunCount === 1) {
      entity = pubFunAbis[0];
    } else {

      const pubFuncIndexASM = usASM.slice(usASM.lastIndexOf(' ') + 1);
      const pubFuncIndex = hex2int(Script.fromASM(pubFuncIndexASM).toHex());
      entity = pubFunAbis.find(entity => entity.index === Number(pubFuncIndex));
    }

    if (!entity) {
      throw new Error(`the unlocking script cannot match the contract '${this.artifact.contract}'`);
    }

    const cParams = entity.params || [];
    
    const resolver = buildTypeResolverFromArtifact(this.artifact);
    const dummyArgs = cParams.map(p => {
      const dummyArg = Object.assign({}, p, { value: false });
      return flatternArg(dummyArg, resolver, { state: true, ignoreValue: true });
    }).flat(Infinity) as Arguments;


    let fArgsLen = dummyArgs.length;
    if (this.artifact.abi.length > 2 && entity.index !== undefined) {
      fArgsLen += 1;
    }
    const asmOpcodes = usASM.split(' ');
    if (fArgsLen != asmOpcodes.length) {
      throw new Error(`the raw unlockingScript cannot match the arguments of public function ${entity.name} of contract ${this.artifact.contract}`);
    }

    const hexTemplateArgs: Map<string, string> = new Map();
    dummyArgs.forEach((farg: Argument, index: number) => {
      hexTemplateArgs.set(`<${farg.name}>`, Script.fromASM(asmOpcodes[index]).toHex());
    });

    const args: Arguments = cParams.map(
      param => deserializeArgfromHex(
        resolver, 
        Object.assign(
          param, 
          {
            value: false //fake value
          }
        ), 
        hexTemplateArgs, 
      )
    );

    return {
      method: entity.name,
      args,
    }
  }

  /**
   * Flattens a struct object into Arguments format using the contract's ABI type resolver.
   * @param arg - The struct object to flatten
   * @param type - The type definition of the struct
   * @param ignoreValue - Whether to ignore the actual values (default: false)
   * @returns The flattened arguments representation of the struct
   */
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

  /**
   * Transforms input arguments according to parameter definitions.
   * @param args - Input arguments to transform
   * @param params - Parameter definitions to use for transformation
   * @returns Array of transformed arguments
   */
  private transformerArgs(args: SupportedParamType, params: ParamEntity[]): SupportedParamType[] {
    return params.map((p, index) => this.transformerArg(args[index], p));
  }

  /**
   * Transforms a contract argument based on its parameter type definition.
   * Handles array, library, struct, and numeric type conversions recursively.
   * 
   * @param arg - The input argument to transform
   * @param param - The parameter type definition from the ABI
   * @returns The transformed argument matching the expected parameter type
   */
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
