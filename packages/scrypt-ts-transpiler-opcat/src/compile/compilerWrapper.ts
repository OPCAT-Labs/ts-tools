import { ChildProcess, exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { rimrafSync } from 'rimraf';
import JSONbig from 'json-bigint';
import { buildTypeResolver } from '../resolver';
import { md5, path2uri, sha1 } from '../utils';
import { findCompiler } from './findCompiler';
import {
  ABI,
  ABIEntity,
  ABIEntityType,
  AliasEntity,
  Artifact,
  ContractEntity,
  CURRENT_CONTRACT_ARTIFACT_VERSION,
  LibraryEntity,
  ParamEntity,
  StaticEntity,
  StructEntity,
  TypeResolver,
} from '@opcat-labs/scrypt-ts-opcat';
import { Indexer, Symbol } from '../indexer';
import { Relinker } from '../relinker';

const SYNTAX_ERR_REG =
  /(?<filePath>[^\s]+):(?<line>\d+):(?<column>\d+):\n([^\n]+\n){3}(unexpected (?<unexpected>[^\n]+)\nexpecting (?<expecting>[^\n]+)|(?<message>[^\n]+))/g;
const SEMANTIC_ERR_REG =
  /Error:(\s|\n)*(?<filePath>[^\s]+):(?<line>\d+):(?<column>\d+):(?<line1>\d+):(?<column1>\d+):*\n(?<message>[^\n]+)\n/g;
const INTERNAL_ERR_REG = /Internal error:(?<message>.+)/;
const WARNING_REG =
  /Warning:(\s|\n)*(?<filePath>[^\s]+):(?<line>\d+):(?<column>\d+):(?<line1>\d+):(?<column1>\d+):*\n(?<message>[^\n]+)\n/g;
const JSONbigAlways = JSONbig({ alwaysParseAsBig: true, constructorAction: 'preserve' });

//SOURCE_REG parser src eg: [0:6:3:8:4#Bar.constructor:0]
export const SOURCE_REG =
  /^(?<fileIndex>-?\d+):(?<line>\d+):(?<col>\d+):(?<endLine>\d+):(?<endCol>\d+)(#(?<tagStr>.+))?/;
const RELATED_INFORMATION_REG =
  /(?<filePath>[^\s]+):(?<line>\d+):(?<column>\d+):(?<line1>\d+):(?<column1>\d+)/gi;

// see VERSIONLOG.md

export enum CompileErrorType {
  SyntaxError = 'SyntaxError',
  SemanticError = 'SemanticError',
  InternalError = 'InternalError',
  Warning = 'Warning',
}

export enum BuildType {
  Debug = 'debug',
  Release = 'release',
}

export interface RelatedInformation {
  filePath: string;
  position: [
    {
      line: number;
      column: number;
    },
    {
      line: number;
      column: number;
    }?,
  ];
  message: string;
}

export interface CompileErrorBase {
  type: string;
  filePath: string;
  position: [
    {
      line: number;
      column: number;
    },
    {
      line: number;
      column: number;
    }?,
  ];
  message: string;
  relatedInformation: RelatedInformation[];
}

export interface SyntaxError extends CompileErrorBase {
  type: CompileErrorType.SyntaxError;
  unexpected: string;
  expecting: string;
}

export interface SemanticError extends CompileErrorBase {
  type: CompileErrorType.SemanticError;
}

export interface InternalError extends CompileErrorBase {
  type: CompileErrorType.InternalError;
}

export interface Warning extends CompileErrorBase {
  type: CompileErrorType.Warning;
}

export type CompileError =
  | SyntaxError
  | SemanticError
  | InternalError
  | Warning;

export class CompileResult {
  constructor(
    public errors: CompileError[],
    public warnings: Warning[],
  ) {}

  asm?: OpCode[];
  hex?: string;
  ast?: Record<string, unknown>;
  dependencyAsts?: Record<string, unknown>;
  abi?: Array<ABIEntity>;
  staticAbis?: Array<ABIEntity>;
  stateProps?: Array<ParamEntity>;
  stateType?: string;
  compilerVersion?: string;
  contract?: string;
  md5?: string;
  structs?: Array<StructEntity>;
  library?: Array<LibraryEntity>;
  contracts?: Array<ContractEntity>;
  alias?: Array<AliasEntity>;
  file?: string;
  buildType?: string;
  autoTypedVars?: AutoTypedVar[];
  statics?: Array<StaticEntity>;
  sources?: Array<string>;
  sourceMap?: Array<string>;
  sourceMapFile?: string;
  dbgFile?: string;

  toArtifact(): Artifact {
    const errors = this.errors.filter((e) => e.type !== CompileErrorType.Warning);
    if (errors.length > 0) {
      throw new Error(`CompileResult contains errors: ${errors.map((e) => e.message).join('\n')}`);
    }

    const artifact: Artifact = {
      version: CURRENT_CONTRACT_ARTIFACT_VERSION,
      compilerVersion: this.compilerVersion || '0.0.0',
      contract: this.contract || '',
      md5: this.md5 || '',
      structs: this.structs || [],
      library: this.library || [],
      alias: this.alias || [],
      abi: this.abi || [],
      staticAbi: this.staticAbis || [],
      stateProps: this.stateProps || [],
      stateType: this.stateType,
      buildType: this.buildType || BuildType.Release,
      file: this.file || '',
      hex: this.hex || '',
    };

    return artifact;
  }
}

export enum DebugModeTag {
  FuncStart = 'F0',
  FuncEnd = 'F1',
  LoopStart = 'L0',
}

export interface DebugInfo {
  tag: DebugModeTag;
  contract: string;
  func: string;
  context: string;
}

export interface Pos {
  file: string;
  line: number;
  endLine: number;
  column: number;
  endColumn: number;
}

export interface OpCode {
  opcode: string;
  stack?: string[];
  topVars?: string[];
  pos?: Pos;
  debugInfo?: DebugInfo;
}

export interface AutoTypedVar {
  name: string;
  pos: Pos;
  type: string;
}

export interface CompilingSettings {
  ast?: boolean;
  asm?: boolean;
  hex?: boolean;
  debug?: boolean;
  artifact?: boolean;
  outputDir?: string;
  outputToFiles?: boolean;
  cwd?: string;
  cmdPrefix?: string;
  cmdArgs?: string;
  buildType?: string;
  stdout?: boolean;
  sourceMap?: boolean;
  timeout?: number; // in ms
  optimize?: boolean;
}

function toOutputDir(artifactsDir: string, sourcePath: string) {
  return join(artifactsDir, basename(sourcePath) + '-' + sha1(sourcePath).substring(0, 10));
}
export function doCompileAsync(
  source: {
    path: string;
    content?: string;
  },
  settings: CompilingSettings,
  callback?: (
    error: Error | null,
    result: {
      path: string;
      output: string;
    } | null,
  ) => void,
): ChildProcess {
  const sourcePath = source.path;
  const srcDir = dirname(sourcePath);
  const curWorkingDir = settings.cwd || srcDir;

  const timeout = settings.timeout || 1200000;
  const sourceContent =
    source.content !== undefined ? source.content : readFileSync(sourcePath, 'utf8');
  const cmd = settings2cmd(sourcePath, settings);
  const childProcess = exec(
    cmd,
    { cwd: curWorkingDir, timeout, killSignal: 'SIGKILL' },
    (error: Error | null, stdout: string) => {
      if (error) {
        console.error(`exec error: ${error} stdout: ${stdout}`);
        if (callback) {
          callback(error, null);
        }

        return;
      }
      if (callback) {
        callback(null, {
          path: sourcePath,
          output: stdout,
        });
      }
    },
  );

  const stdin = childProcess.stdin;
  if (stdin) {
    stdin.write(sourceContent, (error: Error | null | undefined) => {
      if (error) {
        if (callback) {
          callback(error, null);
        }

        return;
      }

      stdin.end();
    });
  }

  return childProcess;
}

export function compileAsync(
  source: {
    path: string;
    content?: string;
  },
  settings: CompilingSettings,
): Promise<CompileResult> {
  settings = Object.assign({}, defaultCompilingSettings, settings);
  return new Promise((resolve, reject) => {
    doCompileAsync(source, settings, (error: Error | null, data) => {
      if (error) {
        reject(error);
        return;
      }

      if (data) {
        try {
          const result = handleCompilerOutput(source.path, settings, data.output);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

const defaultCompilingSettings = {
  ast: true,
  asm: false,
  hex: true,
  debug: false,
  artifact: false,
  outputDir: '',
  outputToFiles: false,
  cwd: '',
  cmdPrefix: '',
  cmdArgs: '',
  buildType: BuildType.Release,
  stdout: false,
  sourceMap: false,
  timeout: 1200000, // in ms
  optimize: false,
};

export function settings2cmd(sourcePath: string, settings: CompilingSettings): string {
  const srcDir = dirname(sourcePath);
  //dir that store artifact file
  const artifactDir = settings.outputDir || srcDir;
  //dir that store ast,asm file
  const outputDir = toOutputDir(artifactDir, sourcePath);
  const cmdPrefix = settings.cmdPrefix || findCompiler();
  let outOption = `-o "${outputDir}"`;
  if (settings.stdout) {
    outOption = '--stdout';
    return `"${cmdPrefix}" compile ${settings.asm || settings.artifact ? '--asm' : ''} ${
      settings.hex ? '--hex' : ''
    } ${settings.optimize ? '-O' : ''} ${settings.ast || settings.artifact ? '--ast' : ''} ${
      settings.debug == true ? '--debug' : ''
    } -r ${outOption} ${settings.cmdArgs ? settings.cmdArgs : ''}`;
  } else {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir);
    }
  }
  return `"${cmdPrefix}" compile ${settings.hex ? '--hex' : ''} ${settings.optimize ? '-O' : ''} ${
    settings.ast || settings.artifact ? '--ast' : ''
  } ${settings.debug == true ? '--debug' : ''} ${
    settings.sourceMap == true ? '--source-map' : ''
  } -r ${outOption} ${settings.cmdArgs ? settings.cmdArgs : ''}`;
}

export function compile(
  source: {
    path: string;
    content?: string;
  },
  settings: CompilingSettings,
): CompileResult {
  const sourcePath = source.path;
  const srcDir = dirname(sourcePath);
  //dir that stores artifact file

  const curWorkingDir = settings.cwd || srcDir;

  settings = Object.assign({}, defaultCompilingSettings, settings);

  const sourceContent =
    source.content !== undefined ? source.content : readFileSync(sourcePath, 'utf8');

  const maxBuffer = settings.stdout ? 1024 * 1024 * 100 : 1024 * 1024;
  settings = Object.assign({}, defaultCompilingSettings, settings);
  const cmd = settings2cmd(sourcePath, settings);
  const output = execSync(cmd, {
    input: sourceContent,
    cwd: curWorkingDir,
    timeout: settings.timeout,
    maxBuffer: maxBuffer,
  }).toString();
  return handleCompilerOutput(sourcePath, settings, output);
}

function calcHexMd5(hex: string) {
  const chex = hex.replace(/<([^>]+)>/g, '<>');
  return md5(chex);
}


export function handleCompilerOutput(
  sourcePath: string,
  settings: CompilingSettings,
  output: string,
): CompileResult {
  const srcDir = dirname(sourcePath);
  const sourceFileName = basename(sourcePath);
  const artifactsDir = settings.outputDir || srcDir;
  const outputDir = toOutputDir(artifactsDir, sourcePath);
  const outputFiles = {};
  try {
    // Because the output of the compiler on the win32 platform uses crlf as a newline， here we change \r\n to \n. make SYNTAX_ERR_REG、SEMANTIC_ERR_REG、IMPORT_ERR_REG work.
    output = output.split(/\r?\n/g).join('\n');
    const result: CompileResult = new CompileResult([], []);
    const cwd = settings.cmdPrefix ? settings.cmdPrefix : findCompiler();

    if (!cwd) {
      throw new Error('No sCrypt compiler found');
    }

    result.compilerVersion = compilerVersion(cwd);
    result.buildType = settings.buildType || BuildType.Release;
    if (output.startsWith('Error:') || output.startsWith('Warning:')) {
      Object.assign(result, getErrorsAndWarnings(output, srcDir, sourceFileName));

      if (result.errors.length > 0) {
        return result;
      }

      if (settings.stdout && result.warnings.length > 0) {
        // stdout not allowed warnings
        return result;
      }
    }

    if (settings.stdout) {
      const stdout = JSONbigAlways.parse(output);

      parserAst(result, stdout.ast, srcDir, sourceFileName, sourcePath);

      parserASM(result, stdout.asm, settings, srcDir, sourceFileName);
    } else {
      if (settings.ast || settings.artifact) {
        const outputFilePath = getOutputFilePath(outputDir, 'ast');
        const astFile = outputFilePath.replace('stdin', basename(sourcePath, '.scrypt'));
        renameSync(outputFilePath, astFile);
        outputFiles['ast'] = astFile;
        const ast = JSONbigAlways.parse(readFileSync(astFile, 'utf8'));
        parserAst(result, ast, srcDir, sourceFileName, sourcePath);
      }

      if (settings.hex || settings.artifact) {
        const outputFilePath = getOutputFilePath(outputDir, 'hex');
        const hexFile = outputFilePath.replace('stdin', basename(sourcePath, '.scrypt'));
        renameSync(outputFilePath, hexFile);
        outputFiles['hex'] = hexFile;
        result.hex = readFileSync(hexFile, 'utf8');
        result.md5 = calcHexMd5(result.hex);
      }

      if (settings.sourceMap) {
        const outputFilePath = getOutputFilePath(outputDir, 'map');
        if (settings.artifact) {
          const dist = getOutputFilePath(artifactsDir, 'map');
          const sourceMapFile = dist.replace('stdin', basename(sourcePath, '.scrypt'));
          renameSync(outputFilePath, sourceMapFile);
          result.sourceMapFile = path2uri(sourceMapFile);
        } else {
          const sourceMapFile = outputFilePath.replace('stdin', basename(sourcePath, '.scrypt'));
          renameSync(outputFilePath, sourceMapFile);
          outputFiles['map'] = sourceMapFile;
          result.sourceMapFile = path2uri(sourceMapFile);
        }
      }

      if (settings.debug) {
        const outputFilePath = getOutputFilePath(outputDir, 'dbg');
        const dbgFile = outputFilePath.replace('stdin', basename(sourcePath, '.scrypt'));
        renameSync(outputFilePath, dbgFile);
        result.dbgFile = path2uri(dbgFile);
      }

      // inject state type from transpiling result file `scrypt.index.json`
      const indexFile = Indexer.queryIndexFile(sourcePath, process.cwd());
      const pkgInfo = Relinker.getFilePackageInfo(sourcePath);
      if (indexFile) {
        const indexer = new Indexer(indexFile);

        // set state type for libraries
        result.library?.forEach((lib) => {
          const stateType = indexer.symbolInfos.get(
            lib.name ? (Relinker.getUnRenamedSymbol(lib.name) as Symbol) : undefined,
          )?.stateType;
          lib.stateType =
            stateType &&
            Relinker.getRenamedSymbol(stateType, pkgInfo.packageName, pkgInfo.packageVersion);
        });

        // set state type for contract
        const stateType = indexer.symbolInfos.get(
          Relinker.getUnRenamedSymbol(result.contract as string) as Symbol,
        )?.stateType;
        result.stateType =
          stateType &&
          Relinker.getRenamedSymbol(stateType, pkgInfo.packageName, pkgInfo.packageVersion);
      } else {
        throw new Error(
          `Cannot find \`scrypt.index.json\` file, run \`npm run build\` to generate it.`,
        );
      }

      if (settings.artifact) {
        const outputFilePath = getOutputFilePath(artifactsDir, 'artifact');
        const artifactFile = outputFilePath.replace('stdin', basename(sourcePath, '.scrypt'));
        const artifact = result.toArtifact();

        writeFileSync(
          artifactFile,
          JSON.stringify(
            artifact,
            (key, value) => {
              if (key === 'file') {
                return relative(artifactFile, value);
              }

              //ignore deprecated fields
              if (key == 'sources' || key == 'sourceMap' || key === 'asm') return undefined;
              else return value;
            },
            2,
          ),
        );
      }

      const indexer = new Indexer();
      indexer.updateMd5(
        Relinker.getUnRenamedSymbol(result.contract as string) as Symbol,
        result.md5,
      );
      indexer.save();
    }

    return result;
  } finally {
    doClean(settings, outputFiles, outputDir);
  }
}

export function compilerVersion(cwd: string): string | undefined {
  try {
    const text = execSync(`"${cwd}" version`).toString();

    const res = /Version:\s*([^\s]+)\s*/.exec(text);

    if (res) {
      return res[1];
    }
  } catch (e) {
    throw new Error(`compilerVersion fail when run: ${cwd} version: ${e.message}`);
  }

  return undefined;
}

function addSourceLocation(astRoot, basePath: string, curFileName: string) {
  for (const fileName in astRoot) {
    if (fileName === 'std') {
      astRoot['std'] = _addSourceLocationProperty(astRoot['std'], 'std');
    } else {
      const realFileName = fileName === 'stdin' ? curFileName : fileName;
      const uri = path2uri(join(basePath, realFileName));
      astRoot[uri] = _addSourceLocationProperty(astRoot[fileName], uri);
      delete astRoot[fileName];
    }
  }
  return astRoot;
}

function _addSourceLocationProperty(astObj, uri: string | null) {
  if (!(typeof astObj === 'object')) {
    return astObj;
  }
  for (const field in astObj) {
    const value = astObj[field];
    if (field === 'src') {
      const matches = /:(\d+):(\d+):(\d+):(\d+)/.exec(value);
      if (!matches) {
        astObj.loc = null;
      } else {
        astObj.loc = {
          source: uri,
          start: { line: parseInt(matches[1]), column: parseInt(matches[2]) },
          end: { line: parseInt(matches[3]), column: parseInt(matches[4]) },
        };
      }
      delete astObj['src'];
    } else if (typeof value === 'object') {
      _addSourceLocationProperty(value, uri);
    }
  }

  return astObj;
}

function getOutputFilePath(
  baseDir: string,
  target: 'ast' | 'asm' | 'hex' | 'artifact' | 'map' | 'dbg',
): string {
  if (target == 'hex') {
    return join(baseDir, `stdin_${target}.txt`);
  } else if (target === 'map') {
    return join(baseDir, `stdin.${target}.json`);
  } else if (target === 'dbg') {
    return join(baseDir, `stdin.${target}.json`);
  } else if (target === 'artifact') {
    return join(baseDir, 'stdin.json');
  }
  return join(baseDir, `stdin_${target}.json`);
}

export function getFullFilePath(
  relativePath: string,
  baseDir: string,
  curFileName: string,
): string {
  if (relativePath.endsWith('stdin')) {
    return join(baseDir, curFileName); // replace 'stdin' with real current compiling file name.
  }

  if (relativePath === 'std') {
    return 'std'; //
  }

  return join(baseDir, relativePath);
}

function getConstructorDeclaration(mainContract): ABIEntity {
  // explict constructor
  if (mainContract['constructor']) {
    return {
      type: ABIEntityType.CONSTRUCTOR,
      params: mainContract['constructor']['params'].map((p) => {
        return { name: p['name'], type: p['type'] };
      }),
    };
  } else {
    // implicit constructor
    return {
      type: ABIEntityType.CONSTRUCTOR,
      params: mainContract['properties'].map((p) => {
        return { name: p['name'].replace('this.', ''), type: p['type'] };
      }),
    };
  }
}

function getStateProps(astRoot): Array<ParamEntity> {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (mainContract && mainContract['properties']) {
    return mainContract['properties']
      .filter((p) => p.state)
      .map((p) => {
        return { name: p['name'].replace('this.', ''), type: p['type'] };
      });
  }
  return [];
}

function getPublicFunctionDeclaration(mainContract: object): ABIEntity[] {
  let pubIndex = 0;
  const interfaces: ABIEntity[] = mainContract['functions']
    .filter((f) => f['visibility'] === 'Public')
    .map((f) => {
      const entity: ABIEntity = {
        type: ABIEntityType.FUNCTION,
        name: f['name'],
        index: f['nodeType'] === 'Constructor' ? undefined : pubIndex++,
        params: f['params'].map((p) => {
          return { name: p['name'], type: p['type'] };
        }),
      };
      return entity;
    });
  return interfaces;
}

function getStaticFunctionDeclaration(mainContract: object): ABIEntity[] {
  let staticIndex = 0;
  const interfaces: ABIEntity[] = mainContract['functions']
    .filter((f) => f['static'] === true)
    .map((f) => {
      const entity: ABIEntity = {
        type: ABIEntityType.FUNCTION,
        name: f['name'],
        index: staticIndex++,
        params: f['params'].map((p) => {
          return { name: p['name'], type: p['type'] };
        }),
        returnType: f['returnType'],
      };
      return entity;
    });
  return interfaces;
}

export function getContractName(astRoot: object): string {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (!mainContract) {
    return '';
  }
  return mainContract['name'] || '';
}

function shortGenericType(genericType: string): string {
  const m = genericType.match(/__SCRYPT_(\w+)__/);
  if (m) {
    return m[1];
  }
  return genericType;
}

/**
 *
 * @param astRoot AST root node after main contract compilation
 * @param typeResolver a Type Resolver
 * @returns All function ABIs defined by the main contract, including constructors
 */
export function getABIDeclaration(astRoot: object, typeResolver: TypeResolver): ABI {
  const mainContract = astRoot['contracts'][astRoot['contracts'].length - 1];
  if (!mainContract) {
    return {
      contract: '',
      abi: [],
      staticAbis: [],
    };
  }

  const interfaces: ABIEntity[] = getPublicFunctionDeclaration(mainContract);
  const constructorABI = getConstructorDeclaration(mainContract);

  interfaces.push(constructorABI);

  interfaces.forEach((abi) => {
    abi.params = abi.params.map((param) => {
      return Object.assign(param, {
        type: typeResolver(param.type).finalType,
      });
    });
  });

  const staticAbis: ABIEntity[] = getStaticFunctionDeclaration(mainContract);

  return {
    contract: getContractName(astRoot),
    abi: interfaces,
    staticAbis,
  };
}

/**
 *
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined structures of the main contract and dependent contracts
 */
export function getStructDeclaration(astRoot: object, dependencyAsts: object): Array<StructEntity> {
  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach((key) => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst
    .map((ast) => {
      return (ast['structs'] || []).map((s) => ({
        name: s['name'],
        params: s['fields'].map((p) => {
          return { name: p['name'], type: p['type'] };
        }),
        genericTypes: s.genericTypes || [],
      }));
    })
    .flat(1);
}

/**
 *
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined Library of the main contract and dependent contracts
 */
export function getLibraryDeclaration(
  astRoot: object,
  dependencyAsts: object,
): Array<LibraryEntity> {
  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach((key) => {
    if (key !== 'std') {
      allAst.push(dependencyAsts[key]);
    }
  });

  return allAst
    .map((ast) => {
      return (ast['contracts'] || [])
        .filter((c) => c.nodeType == 'Library')
        .map((c) => {
          if (c['constructor']) {
            return {
              name: c.name,
              params: c['constructor']['params'].map((p) => {
                return { name: `ctor.${p['name']}`, type: p['type'] };
              }),
              properties: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              genericTypes: c.genericTypes || [],
            };
          } else {
            // implicit constructor
            return {
              name: c.name,
              params: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              properties: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              genericTypes: c.genericTypes || [],
            };
          }
        });
    })
    .flat(1);
}

export function getContractDeclaration(
  astRoot: object,
  dependencyAsts: object,
): Array<ContractEntity> {
  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach((key) => {
    if (key !== 'std') {
      allAst.push(dependencyAsts[key]);
    }
  });

  return allAst
    .map((ast) => {
      return (ast['contracts'] || [])
        .filter((c) => c.nodeType == 'Contract')
        .map((c) => {
          if (c['constructor']) {
            return {
              name: c.name,
              params: c['constructor']['params'].map((p) => {
                return { name: `ctor.${p['name']}`, type: p['type'] };
              }),
              properties: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              genericTypes: c.genericTypes || [],
            };
          } else {
            // implicit constructor
            return {
              name: c.name,
              params: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              properties: c['properties'].map((p) => {
                return { name: p['name'], type: p['type'] };
              }),
              genericTypes: c.genericTypes || [],
            };
          }
        });
    })
    .flat(1);
}

/**
 *
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined type aliaes of the main contract and dependent contracts
 */
export function getAliasDeclaration(astRoot: object, dependencyAsts: object): Array<AliasEntity> {
  const allAst = [astRoot];

  Object.keys(dependencyAsts).forEach((key) => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst
    .map((ast) => {
      return (ast['alias'] || []).map((s) => ({
        name: s['alias'],
        type: s['type'],
      }));
    })
    .flat(1);
}

/**
 *
 * @param astRoot AST root node after main contract compilation
 * @param dependencyAsts AST root node after all dependency contract compilation
 * @returns all defined static const int literal of the main contract and dependent contracts
 */
export function getStaticDeclaration(astRoot: object, dependencyAsts: object): Array<StaticEntity> {
  const allAst = [astRoot];
  Object.keys(dependencyAsts).forEach((key) => {
    allAst.push(dependencyAsts[key]);
  });

  return allAst
    .map((ast) => {
      return (ast['contracts'] || []).map((contract) => {
        return (contract.statics || []).map((node) => {
          return {
            const: node.const,
            name: `${contract.name}.${node.name}`,
            type: node.type,
            value: resolveConstValue(node),
          };
        });
      });
    })
    .flat(Infinity)
    .flat(1)
    .filter((item) => item.const && item.value);
}

function getRelatedInformation(
  message: string,
  srcDir: string,
  sourceFileName: string,
): {
  relatedInformation: RelatedInformation[];
  message: string;
} {
  const relatedInformation: RelatedInformation[] = [];
  let result;

  while ((result = RELATED_INFORMATION_REG.exec(message))) {
    const relatedFilePath = result.groups.filePath;
    if (relatedFilePath === 'null') continue;
    const fullFilePath = getFullFilePath(relatedFilePath, srcDir, sourceFileName);
    const line = parseInt(result.groups?.line || '-1');
    const column = parseInt(result.groups?.column || '-1');
    relatedInformation.push({
      filePath: fullFilePath,
      position: [
        {
          line: line,
          column: column,
        },
        {
          line: parseInt(result.groups?.line1 || '-1'),
          column: parseInt(result.groups?.column1 || '-1'),
        },
      ],
      message: '',
    });
    message = message.replace(/([^\s]+):(\d+):(\d+):(\d+):(\d+)/, '');
  }
  return {
    relatedInformation,
    message,
  };
}

function getErrorsAndWarnings(
  output: string,
  srcDir: string,
  sourceFileName: string,
): CompileResult {
  const warnings: Warning[] = [...output.matchAll(WARNING_REG)].map((match) => {
    const filePath = match.groups?.filePath || '';
    const origin_message = match.groups?.message || '';
    const { message, relatedInformation } = getRelatedInformation(
      origin_message,
      srcDir,
      sourceFileName,
    );
    return {
      type: CompileErrorType.Warning,
      filePath: getFullFilePath(filePath, srcDir, sourceFileName),
      position: [
        {
          line: parseInt(match.groups?.line || '-1'),
          column: parseInt(match.groups?.column || '-1'),
        },
        {
          line: parseInt(match.groups?.line1 || '-1'),
          column: parseInt(match.groups?.column1 || '-1'),
        },
      ],
      message: message,
      relatedInformation: relatedInformation,
    };
  });

  const INTERNAL_ERR = output.match(INTERNAL_ERR_REG);
  if (INTERNAL_ERR) {
    const errors: CompileError[] = [
      {
        type: CompileErrorType.InternalError,
        filePath: getFullFilePath('stdin', srcDir, sourceFileName),
        message: `Compiler internal error: ${INTERNAL_ERR.groups?.message || ''}`,
        position: [
          {
            line: 1,
            column: 1,
          },
          {
            line: 1,
            column: 1,
          },
        ],
        relatedInformation: [],
      },
    ];

    return new CompileResult(errors, warnings);
  } else if (output.includes('Syntax error:')) {
    const syntaxErrors: CompileError[] = [...output.matchAll(SYNTAX_ERR_REG)].map((match) => {
      const filePath = match.groups?.filePath || '';
      const unexpected = match.groups?.unexpected || '';
      const expecting = match.groups?.expecting || '';
      const origin_message =
        match.groups?.message || `unexpected ${unexpected}\nexpecting ${expecting}`;
      const { message, relatedInformation } = getRelatedInformation(
        origin_message,
        srcDir,
        sourceFileName,
      );
      return {
        type: CompileErrorType.SyntaxError,
        filePath: getFullFilePath(filePath, srcDir, sourceFileName),
        position: [
          {
            line: parseInt(match.groups?.line || '-1'),
            column: parseInt(match.groups?.column || '-1'),
          },
        ],
        message: message,
        unexpected,
        expecting,
        relatedInformation: relatedInformation,
      };
    });

    return new CompileResult(syntaxErrors, warnings);
  } else {
    const semanticErrors: CompileError[] = [...output.matchAll(SEMANTIC_ERR_REG)].map((match) => {
      const origin_message = match.groups?.message || '';
      const filePath = match.groups?.filePath || '';
      const { message, relatedInformation } = getRelatedInformation(
        origin_message,
        srcDir,
        sourceFileName,
      );

      return {
        type: CompileErrorType.SemanticError,
        filePath: getFullFilePath(filePath, srcDir, sourceFileName),
        position: [
          {
            line: parseInt(match.groups?.line || '-1'),
            column: parseInt(match.groups?.column || '-1'),
          },
          {
            line: parseInt(match.groups?.line1 || '-1'),
            column: parseInt(match.groups?.column1 || '-1'),
          },
        ],
        message: message,
        relatedInformation: relatedInformation,
      };
    });

    return new CompileResult(semanticErrors, warnings);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveConstValue(node: any): string | undefined {
  if (node.expr.nodeType === 'IntLiteral') {
    return node.expr.value.toString(10);
  } else if (node.type === 'int' && node.expr.nodeType === 'Variable') {
    return node.expr.name;
  } else if (
    node.type === 'int' &&
    node.expr.nodeType === 'BinaryExpr' &&
    node.expr.name === 'Dot'
  ) {
    return `${node.expr.lExpr.name}.${node.expr.rExpr.name}`;
  }
  return undefined;
}

function parserAst(
  result: CompileResult,
  ast: object,
  srcDir: string,
  sourceFileName: string,
  sourcePath: string,
) {
  const allAst = addSourceLocation(ast, srcDir, sourceFileName);

  const sourceUri = path2uri(sourcePath);
  result.file = sourcePath;
  result.ast = allAst[sourceUri];
  delete allAst[sourceUri];
  result.dependencyAsts = allAst;

  const alias = getAliasDeclaration(result.ast!, allAst);
  const structs = getStructDeclaration(result.ast!, allAst);
  const library = getLibraryDeclaration(result.ast!, allAst);

  const statics = getStaticDeclaration(result.ast!, allAst);

  result.contracts = getContractDeclaration(result.ast!, allAst);
  const typeResolver = buildTypeResolver(
    getContractName(result.ast!),
    alias,
    structs,
    library,
    result.contracts,
    statics,
  );

  result.alias = alias.map((a) => ({
    name: a.name,
    type: typeResolver(a.type).finalType,
  }));

  result.structs = structs.map((a) => ({
    name: a.name,
    params: a.params.map((p) => ({ name: p.name, type: typeResolver(p.type).finalType })),
    genericTypes: a.genericTypes.map((t) => shortGenericType(t)),
  }));

  result.library = library.map((a) => ({
    name: a.name,
    params: a.params.map((p) => ({ name: p.name, type: typeResolver(p.type).finalType })),
    properties: a.properties.map((p) => ({ name: p.name, type: typeResolver(p.type).finalType })),
    genericTypes: a.genericTypes.map((t) => shortGenericType(t)),
  }));

  result.statics = statics.map((s) =>
    Object.assign(
      { ...s },
      {
        type: typeResolver(s.type).finalType,
      },
    ),
  );

  const { contract: name, abi, staticAbis } = getABIDeclaration(result.ast!, typeResolver);

  result.stateProps = getStateProps(result.ast).map((p) => ({
    name: p.name,
    type: typeResolver(p.type).finalType,
  }));

  result.abi = abi;
  result.staticAbis = staticAbis;
  result.contract = name;
}

/**
 * @deprecated use `--hex` when compiling
 * @param result
 * @param asmObj
 * @param settings
 * @param srcDir
 * @param sourceFileName
 */
function parserASM(
  result: CompileResult,
  asmObj: object,
  settings: CompilingSettings,
  srcDir: string,
  sourceFileName: string,
) {
  const sources = asmObj['sources'];

  if (settings.debug) {
    Object.assign(result, {
      file: result.file,
      sources: asmObj['sources'].map((source) => getFullFilePath(source, srcDir, sourceFileName)),
      sourceMap: asmObj['output'].map((item) => item.src),
    });
  }

  result.hex = settings.hex ? asmObj['output'].map((item) => item.hex).join('') : '';

  result.asm = asmObj['output'].map((item) => {
    if (!settings.debug) {
      return {
        opcode: item.opcode,
      };
    }

    const match = SOURCE_REG.exec(item.src);

    if (match && match.groups) {
      const fileIndex = parseInt(match.groups.fileIndex);

      let debugInfo: DebugInfo | undefined;

      const tagStr = match.groups.tagStr;

      const m = /^(\w+)\.(\w+):(\d)(#(?<context>.+))?$/.exec(tagStr);

      if (m && m.groups) {
        debugInfo = {
          contract: m[1],
          func: m[2],
          tag: m[3] == '0' ? DebugModeTag.FuncStart : DebugModeTag.FuncEnd,
          context: m.groups.context,
        };
      } else if (/loop:0/.test(tagStr)) {
        debugInfo = {
          contract: '',
          func: '',
          tag: DebugModeTag.LoopStart,
          context: '',
        };
      }

      const pos: Pos | undefined = sources[fileIndex]
        ? {
            file: sources[fileIndex]
              ? getFullFilePath(sources[fileIndex], srcDir, sourceFileName)
              : '',
            line: sources[fileIndex] ? parseInt(match.groups.line) : -1,
            endLine: sources[fileIndex] ? parseInt(match.groups.endLine) : -1,
            column: sources[fileIndex] ? parseInt(match.groups.col) : -1,
            endColumn: sources[fileIndex] ? parseInt(match.groups.endCol) : -1,
          }
        : undefined;

      return {
        opcode: item.opcode,
        stack: item.stack,
        topVars: item.topVars || [],
        pos: pos,
        debugInfo,
      } as OpCode;
    }
    throw new Error('Compile Failed: Asm output parsing Error!');
  });

  if (settings.debug) {
    result.autoTypedVars = asmObj['autoTypedVars'].map((item) => {
      const match = SOURCE_REG.exec(item.src);
      let fileIndex = -1;
      if (match && match.groups) {
        fileIndex = parseInt(match.groups.fileIndex);
      }

      const pos: Pos | undefined =
        fileIndex > -1 && sources[fileIndex]
          ? {
              file: sources[fileIndex]
                ? getFullFilePath(sources[fileIndex], srcDir, sourceFileName)
                : '',
              line: sources[fileIndex] ? parseInt(match!.groups!.line) : -1,
              endLine: sources[fileIndex] ? parseInt(match!.groups!.endLine) : -1,
              column: sources[fileIndex] ? parseInt(match!.groups!.col) : -1,
              endColumn: sources[fileIndex] ? parseInt(match!.groups!.endCol) : -1,
            }
          : undefined;

      return {
        name: item.name,
        type: item.type,
        pos: pos,
      };
    });
  }
}

function doClean(
  settings: CompilingSettings,
  outputFiles: Record<string, string>,
  outputDir: string,
) {
  if (settings.stdout || settings.outputToFiles || settings.sourceMap) {
    return;
  }

  try {
    Object.keys(outputFiles).forEach((outputType) => {
      const file = outputFiles[outputType];
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });

    rimrafSync(outputDir);
  } catch (error) {
    console.error('clean compiler output files failed!', error);
  }

  // console.log('compile time spent: ', Date.now() - st)
}

export function compileContract(
  file: string,
  options?: {
    out?: string;
    sourceMap?: boolean;
    artifact?: boolean;
    optimize?: boolean;
  },
): CompileResult {
  options = Object.assign(
    {
      out: dirname(file),
      sourceMap: false,
      artifact: false,
      optimize: true,
    },
    options,
  );
  if (!existsSync(file)) {
    throw `file ${file} not exists!`;
  }

  if (!existsSync(options.out as string)) {
    mkdirSync(options.out as string);
  }

  const result = compile(
    { path: file },
    {
      artifact: options.artifact,
      outputDir: options.out,
      sourceMap: options.sourceMap,
      optimize: options.optimize,
      cmdPrefix: findCompiler(),
    },
  );

  return result;
}

export function compileContractAsync(
  file: string,
  options?: {
    out?: string;
    artifact?: boolean;
    sourceMap?: boolean;
    optimize?: boolean;
  },
): Promise<CompileResult> {
  options = Object.assign(
    {
      out: join(__dirname, '..', 'out'),
      sourceMap: false,
      artifact: false,
      optimize: true,
    },
    options,
  );
  if (!existsSync(file)) {
    throw `file ${file} not exists!`;
  }

  if (!existsSync(options.out as string)) {
    mkdirSync(options.out as string);
  }

  return compileAsync(
    { path: file },
    {
      artifact: options.artifact,
      outputDir: options.out,
      sourceMap: options.sourceMap,
      optimize: options.optimize,
      hex: true,
      cmdPrefix: findCompiler(),
    },
  );
}
