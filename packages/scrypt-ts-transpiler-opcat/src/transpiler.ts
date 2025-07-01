import ts, { ClassDeclaration, isAutoAccessorPropertyDeclaration, MethodDeclaration } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { Indexer, Symbol } from './indexer';
import * as path from 'path';
import {
  allowByteStringLiteral,
  alterFileExt,
  checkByteStringLiteral,
  findBuildChangeOutputExpression,
  findPackageDir,
  findReturnStatement,
  getBuiltInType,
  hasModifier,
  isNumberLiteralExpr,
  number2hex,
  sha1,
  toBuiltinsTypes,
} from './utils';
import { compile, CompileError } from './compile/compilerWrapper';
import { findCompiler } from './compile/findCompiler';
import { tmpdir } from 'os';
import { mkdtempSync, existsSync, readFileSync } from 'fs';
import { Range, TransformationResult, TranspileError, UnknownError } from './types';
import {
  CALL_BUILD_CHANGE_OUTPUT,
  CALL_CHECK_SHPREIMAGE,
  EMPTY_CONSTRUCTOR,
  InjectedParam_ChangeInfo,
  InjectedParam_CurState,
  InjectedParam_Prevouts,
  InjectedParam_SpentAmounts,
  InjectedParam_SpentScriptHashes,
  InjectedParam_SHPreimage,
  InjectedParam_Prevout,
  InjectedProp_ChangeInfo,
  InjectedProp_PrevoutsCtx,
  InjectedProp_SHPreimage,
  InjectedProp_SpentAmounts,
  InjectedProp_SpentScriptHashes,
  InjectedVar_InputCount,
  thisAssignment,
  InjectedProp_SpentDataHashes,
  InjectedParam_SpentDataHashes,
  InjectedProp_NextState,
  InjectedVar_NextState,
  ACCESS_INPUT_COUNT,
  InjectedProp_Prevout,
  InjectedProp_PrevTxHashPreimage,
  InjectedParam_PrevTxHashPreimage,
} from './snippets';
import { MethodDecoratorOptions } from '@opcat-labs/scrypt-ts-opcat';
import { Relinker } from './relinker';

const BUILDIN_PACKAGE_NAME = '@opcat-labs/scrypt-ts-opcat';

/**
 * @ignore
 */
const DEFAULT_AST_COMPILE_OPTS = Object.freeze({
  ast: true,
  asm: false,
  hex: false,
  debug: false,
  artifact: false,
  sourceMap: false,
  outputToFiles: true,
  cmdArgs: '--std',
});

/**
 * @ignore
 */
enum DecoratorName {
  Prop = 'prop',
  Method = 'method',
}

/**
 * @ignore
 */
class EmittedLine {
  prefixTabs: number;
  code: string;
  currentCol: number;
  sourceMap: number[][];

  constructor(prefixTabs = 0, currentCol = 0, codeLines = '', sourceMap = []) {
    this.prefixTabs = prefixTabs;
    this.currentCol = currentCol;
    this.code = codeLines;
    this.sourceMap = sourceMap;
  }

  copy(): EmittedLine {
    return new EmittedLine(
      this.prefixTabs,
      this.currentCol,
      this.code,
      JSON.parse(JSON.stringify(this.sourceMap)),
    );
  }

  findByCol(col: number): number[] {
    for (let i = 0; i < this.sourceMap.length; i++) {
      const sourceMap = this.sourceMap[i];

      if (col >= sourceMap[0]) {
        const nextSourceMap = this.sourceMap[i + 1];

        if (nextSourceMap && col <= nextSourceMap[0]) {
          return sourceMap;
        } else if (!nextSourceMap) {
          return sourceMap;
        }
      }
    }

    return this.sourceMap[0];
  }
}

/**
 * @ignore
 */
class EmittedSection {
  lines: EmittedLine[] = [];
  errors: TranspileError[] = [];

  skipNextAppend: boolean;

  constructor(initialLine?: EmittedLine) {
    if (initialLine) this.lines.push(initialLine);
    this.skipNextAppend = false;
  }

  static join(...sections: EmittedSection[]): EmittedSection {
    const completed = new EmittedSection();
    sections.forEach((sec) => completed.concat(sec));
    return completed;
  }

  getLastLine(): EmittedLine {
    return this.lines[this.lines.length - 1];
  }

  getCode(): string {
    return this.lines.map((l) => l.code).join('\n');
  }

  getSourceMap(): number[][][] {
    return this.lines.map((l) => l.sourceMap);
  }

  append(code: string, srcLocation?: ts.LineAndCharacter): EmittedSection {
    if (this.skipNextAppend) {
      this.skipNextAppend = false;
      return this;
    }
    let lastLine = this.getLastLine();
    const inlineCode = code.replaceAll(/\n/g, '');
    const startNewLine = code.startsWith('\n');
    if (startNewLine || !lastLine) {
      const prefixTab = lastLine?.prefixTabs ?? 0;
      lastLine = new EmittedLine(
        prefixTab,
        prefixTab * 2,
        Array(prefixTab * 2)
          .fill(' ')
          .join('') + inlineCode,
      );
      this.lines.push(lastLine);
    } else {
      lastLine.code += inlineCode;
    }

    if (srcLocation) {
      // adjust col to skip prefix spaces
      const skipSpaceCol = inlineCode.search(/[^ ]/);
      const adjustCol = lastLine.currentCol + (skipSpaceCol > 0 ? skipSpaceCol : 0);
      // sourcemap format: [ generatedCodeColumn, sourceIndex, sourceCodeLine, sourceCodeColumn, nameIndex? ]
      lastLine.sourceMap.push([adjustCol, 0, srcLocation.line, srcLocation.character]);
    }

    lastLine.currentCol += inlineCode.length;

    return this;
  }

  appendWith(
    ctx: Transpiler,
    updater: (base: EmittedSection) => EmittedSection,
    increaseTab = false,
  ): EmittedSection {
    if (this.skipNextAppend) {
      this.skipNextAppend = false;
      return this;
    }
    try {
      // use the last line of current section as the start line of upcoming section
      const initialLine = (this.getLastLine() || new EmittedLine()).copy();
      if (increaseTab) {
        initialLine.prefixTabs += 1;
      }
      this.concat(updater.call(ctx, new EmittedSection(initialLine)), true);
      if (increaseTab) {
        this.getLastLine().prefixTabs -= 1;
      }
    } catch (err) {
      if (err instanceof TranspileError) {
        this.errors.push(err);
      } else {
        throw err;
      }
    }
    return this;
  }

  private concat(postSection: EmittedSection, lastLineOverlays = false): EmittedSection {
    if (lastLineOverlays) this.lines.pop();
    this.lines = this.lines.concat(postSection.lines);
    this.errors = this.errors.concat(postSection.errors);
    return this;
  }
}

/**
 * @ignore
 */
type SmartContractCategory = 'contract' | 'library';

const SmartContractBuiltinMethods = [
  'buildChangeOutput',
  'appendStateOutput',
  'buildStateOutputs',
  'timeLock',
  'checkSig',
  'checkMultiSig',
  'checkPreimageAdvanced',
  'checkPreimageSigHashType',
  'checkPreimage',
  'insertCodeSeparator',
  'checkInputState',
  'backtraceToOutpoint',
  'backtraceToScript',
  'checkOutputs',
];

type AccessInfo = {
  accessSHPreimage: boolean; // this.ctx.shPreimage
  accessSHPreimageInSubCall: boolean; // this.ctx.shPreimage in private function call
  accessChange: boolean; // this.buildChangeOutput()
  accessChangeInSubCall: boolean; // this.buildChangeOutput() in private function call
  accessState: boolean; // this.state
  accessStateInSubCall: boolean; // this.state in private function call
  accessPrevouts: boolean; // this.ctx.prevouts
  accessPrevoutsInSubCall: boolean; // this.ctx.prevouts in private function call
  accessPrevout: boolean; // this.ctx.prevout
  accessPrevoutInSubCall: boolean; // this.ctx.prevout in private function call
  accessSpentScripts: boolean; // this.ctx.spentScripts
  accessSpentScriptsInSubCall: boolean; // this.ctx.spentScripts in private function call
  accessSpentAmounts: boolean; // this.ctx.spentAmounts
  accessSpentAmountsInSubCall: boolean; // this.ctx.spentAmounts in private function call
  accessSpentDataHashes: boolean; // this.state, this.spentDataHashes
  accessSpentDataHashesInSubCall: boolean;
  accessBacktrace: boolean; // this.backtraceToOutpoint, this.backtraceToScript
  accessBacktraceInSubCall: boolean; // this.backtraceToOutpoint, this.backtraceToScript in private function call
  accessCLTV: boolean;
};

type MethodInfo = {
  accessInfo: AccessInfo;
  isPublic: boolean;
  isBase: boolean;
  name: string;
  codeSeparatorCount: number;
};

type PropInfo = {
  name: string;
  isState: boolean;
  isBase: boolean;
  isStatic: boolean;
  isReadonly: boolean;
  isCTC: boolean;
};

/**
 * @ignore
 */
export class Transpiler {
  public static topCtcs = new Map<string, string>();
  public scComponents: ts.ClassDeclaration[] = [];
  // public publicMethods: ts.MethodDeclaration[] = [];

  private methodInfos: Map<string, MethodInfo> = new Map();
  private propInfos: Map<string, PropInfo> = new Map();

  private static contractAst = new Map<string, ts.ClassDeclaration>();

  static readonly scryptFileExt = 'scrypt.tpl';

  _srcFile: ts.SourceFile;
  _host: ts.CompilerHost | undefined;
  _checker: ts.TypeChecker;
  _compilerOptions: ts.CompilerOptions;
  _scryptOutDir: string;
  _tsRootDir: string;
  _indexer: Indexer;

  _builtinIndexer: Indexer;
  _localTypeSymbols = new Map<string, ts.Symbol>();
  _accessBuiltinsSymbols = new Set<string>();
  _importedTypeSymbols = new Map<string, ts.Symbol>();
  _stateTypeSymbols = new Map<string, ts.Symbol>();

  _watch = false;

  _currentContract: ts.ClassDeclaration;
  _currentMethodName: string;
  _currentMethodDecOptions: MethodDecoratorOptions;
  _constructorParametersMap: Map<string, ts.Node> = new Map();

  constructor(
    sourceFile: ts.SourceFile,
    host: ts.CompilerHost | undefined,
    checker: ts.TypeChecker,
    tsRootDir: string,
    scryptOutDir: string,
    indexer: Indexer,
    compilerOptions: ts.CompilerOptions,
  ) {
    this._srcFile = sourceFile;
    this._host = host;
    this._checker = checker;
    this._tsRootDir = tsRootDir;
    this._scryptOutDir = scryptOutDir;
    this._indexer = indexer;
    this._compilerOptions = compilerOptions;
    this._watch = (compilerOptions.watch as boolean) || false;
    this.loadBuiltinIndexer();
    this.searchSmartContractComponents();
    this.searchTopCtcs();
  }

  get ctxMethods() {
    return this.getCtxMethodInfos().map((info) => info.name);
  }

  get _scryptRelativePath() {
    return this.getRelativePathFromTsRoot(this._srcFile.fileName);
  }

  get _scryptFullPath() {
    return path.join(this._scryptOutDir, this._scryptRelativePath);
  }

  get currentContractName() {
    return this._currentContract!.name!.getText();
  }

  get currentbaseContractName() {
    return Transpiler.getBaseContractName(this._currentContract).baseContractName;
  }

  get currentbaseContract() {
    return Transpiler.contractAst.get(this.currentbaseContractName);
  }

  get _transformationResultRelativePath() {
    return alterFileExt(this._scryptRelativePath, 'transformer.json', Transpiler.scryptFileExt);
  }

  get _transformationResultFullPath() {
    return alterFileExt(this._scryptFullPath, 'transformer.json', Transpiler.scryptFileExt);
  }

  get _sourceMapRelativePath() {
    return alterFileExt(this._scryptRelativePath, 'scrypt.map', Transpiler.scryptFileExt);
  }

  get _sourceMapFullPath() {
    return alterFileExt(this._scryptFullPath, 'scrypt.map', Transpiler.scryptFileExt);
  }

  setLocalSymbols(localTypeSymbols: Map<string, ts.Symbol>): void {
    this._localTypeSymbols = localTypeSymbols;
  }

  transform(
    allmissSym: Map<ts.SourceFile, Map<string, ts.Symbol>>,
    relinker: Relinker,
  ): EmittedSection {
    console.log(`transform ${this._srcFile.fileName} to ${this._scryptFullPath}`);

    // transform the contract, library, structs and find its imported symbols
    const contractAndLibs = this.scComponents.map((cDef) => this.transformClassDeclaration(cDef));
    const structs = this.transformTypeLiteralAndInterfaces();

    // transform the import expressions
    const imports = this.transformImports(allmissSym, relinker);
    const result = EmittedSection.join(imports, structs, ...contractAndLibs);

    if (this._watch) {
      setTimeout(() => {
        this.diagnose(result.errors);
      }, 500);
    } else {
      this.outputScrypt(result);
      if (result.errors.length == 0) {
        try {
          relinker.relink(this._scryptFullPath);
        } catch (_err) {
          console.log('relink failed', this._scryptFullPath);
          console.log(_err);
        }
      }
      this.updateIndex();
      this.diagnose(result.errors);
      this.outputSourceMapFile(result);
      this.outputTransformationResult(result);
    }
    return result;
  }

  isTransformable(): boolean {
    return this.scComponents.length > 0;
  }

  getSCComponents() {
    return this.scComponents;
  }

  isFromThirdParty(filepath: string): boolean {
    return filepath.endsWith('.d.ts');
  }

  private outputScrypt(result: EmittedSection) {
    ts.sys.writeFile(this._scryptFullPath, result.getCode());
  }

  private outputTransformationResult(result: EmittedSection) {
    const transResult: TransformationResult = {
      success: result.errors.length === 0,
      errors: result.errors,
      scryptfile: this._scryptRelativePath,
      sourceMapFile: this._sourceMapRelativePath,
      ctxMethods: this.ctxMethods,
    };
    ts.sys.writeFile(this._transformationResultFullPath, JSON.stringify(transResult, null, 2));
  }

  private diagnose(errors: TranspileError[]) {
    errors.forEach((error) => this.outputDiagnostic(error));
  }

  private outputDiagnostic(diag: TranspileError) {
    console.log(
      `${BUILDIN_PACKAGE_NAME} ERROR - ${diag.srcRange.fileName}:${diag.srcRange.start.line}:${diag.srcRange.start.character}:${diag.srcRange.end.line}:${diag.srcRange.end.character} - ${diag.message}\n`,
    );
  }

  // check transformed scrypt code to collect compile time errors
  private checkTransformedScrypt(result: EmittedSection): TranspileError[] {
    if (result.errors.length === 0 && existsSync(this._scryptFullPath)) {
      try {
        const tmpDir = mkdtempSync(path.join(tmpdir(), 'scrypt-ts-btc'));
        const input = {
          path: this._scryptFullPath,
          content: result.getCode(),
        };
        const settings = Object.assign({}, DEFAULT_AST_COMPILE_OPTS, {
          cmdPrefix: findCompiler(),
          outputDir: tmpDir,
        });

        const astResult = compile(input, settings);

        const errors = this.compileError2transpileError(astResult.errors, result.lines);

        return errors;
      } catch (err) {
        // for the case when scrypt compiler crushed.
        return [
          new TranspileError(
            `Internal compilation FATAL error raised for auto-generated file: ${this._scryptFullPath} , please report it as a bug to ${BUILDIN_PACKAGE_NAME}\n${err}`,
            {
              fileName: this._scryptFullPath,
              start: { line: -1, character: -1 },
              end: { line: -1, character: -1 },
            },
          ),
        ];
      }
    }

    return [];
  }

  private compileError2transpileError(
    errors: CompileError[],
    scryptLines: EmittedLine[],
  ): TranspileError[] {
    const tsSrcLines = this._srcFile.getFullText().split('\n');
    return errors.map((error) => {
      const scryptLine = scryptLines[(error.position[0]?.line || 0) - 1];
      const sourcemap = scryptLine
        ? scryptLine.findByCol(error.position[0]?.column || -1)
        : undefined;
      if (sourcemap) {
        const tsLine = sourcemap[2];
        const tsColumn = sourcemap[3];
        // code from current column to end of line
        const tsCode = tsSrcLines[tsLine]
          .slice(tsColumn)
          .replace(/\/\/.*/, '')
          .trim();
        return new TranspileError(
          `The code '${tsCode}' was successfully transformed but compiled with error: ${error.message}`,
          {
            fileName: this._srcFile.fileName,
            start: { line: tsLine, character: tsColumn },
            end: { line: tsLine, character: tsColumn + tsCode.length },
          },
        );
      } else {
        // when can not find sourcemap for the certain `scryptLine`, use the first sourcemap
        const sourcemap = scryptLines[1]?.sourceMap[0];
        return new TranspileError(
          `Internal compilation error raised for auto-generated file: ${this._scryptFullPath}:${error.position[0]?.line || -1
          }:${error.position[0]?.column || -1} , please report it as a bug to ${BUILDIN_PACKAGE_NAME}`,
          {
            fileName: this._srcFile.fileName,
            start: {
              line: sourcemap ? sourcemap[2] : -1,
              character: sourcemap ? sourcemap[3] : -1,
            },
            end: { line: -1, character: -1 },
          },
        );
      }
    });
  }

  private outputSourceMapFile(result: EmittedSection) {
    ts.sys.writeFile(this._sourceMapFullPath, JSON.stringify(result.getSourceMap()));
  }

  private updateIndex() {
    const globalSymbols = Array.from(this._localTypeSymbols.entries()).map(
      ([symbolName, symbol]) => {
        const symbolFile = this.findDeclarationFile(symbol);
        let symbolDec = symbol.declarations![0];
        symbolDec = symbolDec['name'] || symbolDec;
        const stateTypeSymbol = this._stateTypeSymbols.get(symbolName);

        return {
          name: symbolName as Symbol,
          srcRange: {
            fileName: symbolFile!.fileName,
            start: symbolFile!.getLineAndCharacterOfPosition(symbolDec.getStart()),
            end: symbolFile!.getLineAndCharacterOfPosition(symbolDec.getEnd()),
          },
          stateType: stateTypeSymbol?.name as Symbol,
        };
      },
    );
    this._indexer.addSymbols(globalSymbols, this._scryptRelativePath);
  }

  private isExtendsSCComponent(node: ts.ClassDeclaration): boolean {
    let isExtends = false;

    if (this.isContract(node)) {
      Transpiler.contractAst.set(node.name!.getText(), node);
      if (hasModifier(node, ts.SyntaxKind.AbstractKeyword)) {
        // ignore abstract class, then are base contract class
        return false;
      }

      isExtends = true;
    }

    if (this.isLibrary(node)) {
      isExtends = true;
    }

    if (!isExtends) {
      return false;
    }

    const typeParameterNames = (node.typeParameters || []).map((v) => v.name.getText());
    const { typeArgName: stateTypeName, stateTypeNode } = Transpiler.getBaseContractName(node);
    if (stateTypeName) {
      // exclude the case like: `class ContractA<T> extends Base<T>`
      if (typeParameterNames.includes(stateTypeName)) {
        return false;
      }

      if (ts.isTypeReferenceNode(stateTypeNode)) {
        const typeRef = this._checker.getSymbolAtLocation(stateTypeNode.typeName);
        if (typeRef) {
          this._stateTypeSymbols.set(
            node.name!.getText(),
            typeRef.flags & ts.SymbolFlags.Alias
              ? this._checker.getAliasedSymbol(typeRef)
              : typeRef,
          );
        }
      } else {
        // TODO: add support for type literal like: `SmartContract<{ state: number }>`
        // currently, do not support type literal state type, and throw error in `checkLiteralStateType`
      }
    }

    return true;
  }

  private isContract(node: ts.ClassDeclaration): boolean {
    if (Array.isArray(node.heritageClauses) && node.heritageClauses.length === 1) {
      const clause: ts.HeritageClause = node.heritageClauses[0];

      if (clause.token == ts.SyntaxKind.ExtendsKeyword && clause.types.length === 1) {
        const { baseContractName } = Transpiler.getBaseContractName(node);

        return baseContractName === 'SmartContract' || Transpiler.contractAst.has(baseContractName);
      }
    }

    return false;
  }

  private checkLiteralStateType() {
    const node = this._currentContract;
    if (Array.isArray(node.heritageClauses) && node.heritageClauses.length === 1) {
      const clause: ts.HeritageClause = node.heritageClauses[0];
      if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length === 1) {
        const type = clause.types[0];
        if (type.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
          const stateTypeNode = type.typeArguments?.length > 0 ? type.typeArguments[0] : undefined;
          if (stateTypeNode && ts.isTypeLiteralNode(stateTypeNode)) {
            throw new TranspileError(
              `State type of the contract \`${node.name.getText()}\` should be a TypeReference instead of a ${ts.SyntaxKind[stateTypeNode.kind]}`,
              this.getRange(stateTypeNode),
            );
          }
        }
      }
    }
  }

  private static getBaseContractName(node: ts.ClassDeclaration): {
    baseContractName: string;
    typeArgName?: string;
    stateTypeNode?: ts.TypeNode;
  } {
    if (Array.isArray(node.heritageClauses) && node.heritageClauses.length === 1) {
      const clause: ts.HeritageClause = node.heritageClauses[0];

      if (clause.token == ts.SyntaxKind.ExtendsKeyword && clause.types.length === 1) {
        const type = clause.types[0];
        if (type.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
          // get base contract node, and parse the chains
          const baseContractName = type.expression.getText();

          // class Child extends Base<State>
          let typeArgName =
            type.typeArguments?.length > 0 ? type.typeArguments[0].getText() : undefined;
          let stateTypeNode: ts.TypeNode = undefined;
          if (typeArgName) {
            stateTypeNode = node.heritageClauses[0].types[0].typeArguments[0];
          }

          // class Child extends Base
          // class Base extends SmartContract<State>
          if (
            !typeArgName &&
            baseContractName !== 'SmartContract' &&
            baseContractName !== 'SmartContractLib'
          ) {
            const baseContractAst = Transpiler.contractAst.get(baseContractName);
            if (!baseContractAst) {
              return { baseContractName };
            }
            const baseRes = this.getBaseContractName(baseContractAst);
            typeArgName = baseRes.typeArgName;
            stateTypeNode = baseRes.stateTypeNode;
          }

          return {
            baseContractName,
            typeArgName,
            stateTypeNode,
          };
        }
        return {
          baseContractName: type.getText(),
        };
      }
    }

    throw new Error(`Can't get base contract for class ${node.name!.getText()}`);
  }

  private isInherited(node: ts.ClassDeclaration): boolean {
    if (
      node.heritageClauses &&
      node.heritageClauses.length === 1 &&
      node.heritageClauses[0].token === ts.SyntaxKind.ExtendsKeyword
    ) {
      const { baseContractName } = Transpiler.getBaseContractName(node);
      return Transpiler.contractAst.has(baseContractName);
    }
    return false;
  }

  private isTranspilingConstructor(node: ts.Node): boolean {
    if (!node.parent) {
      return false;
    }

    if (ts.isConstructorDeclaration(node.parent)) {
      return true;
    }

    return this.isTranspilingConstructor(node.parent);
  }

  private isTranspilingBaseContract(node: ts.Node): boolean {
    const cls = Transpiler.getClassDeclaration(node);

    if (cls && cls.name!.getText() !== this.currentContractName) {
      return true;
    }

    return false;
  }

  private isLibrary(node: ts.ClassDeclaration): boolean {
    if (
      node.heritageClauses &&
      node.heritageClauses.length === 1 &&
      node?.heritageClauses[0].token === ts.SyntaxKind.ExtendsKeyword
    ) {
      const parentClassName = node?.heritageClauses[0].types[0]?.getText();
      return parentClassName === 'SmartContractLib' || /^StateLib<.+>$/.test(parentClassName);
    }
    return false;
  }

  /**
   * get relative path starting from `tsRootDir`
   * @param fullFilePath
   * @param ext extension of the path
   * @returns
   */
  private getRelativePathFromTsRoot(fullFilePath: string, ext = Transpiler.scryptFileExt): string {
    // ts source file to root dir relative path which will be kept in scrypt output structure.
    let root2srcRelativePath = path.relative(this._tsRootDir, fullFilePath).replaceAll('\\', '/');

    if (root2srcRelativePath.startsWith('src/contracts/')) {
      root2srcRelativePath = root2srcRelativePath.replace('src/contracts/', '');
    }

    if (root2srcRelativePath.startsWith('../')) {
      root2srcRelativePath = root2srcRelativePath.replace('../', '');
    }

    const basename = path.basename(root2srcRelativePath, path.extname(root2srcRelativePath));
    return path
      .join(path.dirname(root2srcRelativePath), `${basename}.${ext}`)
      .replaceAll('\\', '/');
  }
  private getRelativePathFromArtifacts(
    fullFilePath: string,
    ext = Transpiler.scryptFileExt,
  ): string {
    // ts source file to root dir relative path which will be kept in scrypt output structure.
    const relativePath = path.relative(this._scryptOutDir, fullFilePath).replaceAll('\\', '/');
    const basename = path.basename(relativePath, path.extname(relativePath));
    return path.join(path.dirname(relativePath), `${basename}.${ext}`).replaceAll('\\', '/');
  }

  private searchSmartContractComponents() {
    const scComponentDefs = tsquery(this._srcFile, 'ClassDeclaration:has(HeritageClause)');
    const scComponents = scComponentDefs.filter(
      (cDef: ts.Node) => ts.isClassDeclaration(cDef) && this.isExtendsSCComponent(cDef),
    );
    this.scComponents = scComponents as ts.ClassDeclaration[];
  }

  private searchTopCtcs() {
    const declarations = tsquery(
      this._srcFile,
      'SourceFile > VariableStatement > VariableDeclarationList',
    );

    const ctcDeclarations: ts.VariableDeclarationList[] = declarations.filter((d) => {
      if (ts.isVariableDeclarationList(d)) {
        return this.isCtcDeclaration(d.declarations[0]);
      }
      return false;
    }) as ts.VariableDeclarationList[];

    ctcDeclarations.forEach((d: ts.VariableDeclarationList) => {
      Transpiler.topCtcs.set(
        `${sha1(this._srcFile.fileName)}:${d.declarations[0].name.getText()}`,
        this.evalCtcExpression(d.declarations[0].initializer!),
      );
    });
  }

  private getCoordinates(pos?: number): ts.LineAndCharacter | undefined {
    return pos ? this._srcFile.getLineAndCharacterOfPosition(pos) : undefined;
  }

  private getRange(node: ts.Node): Range {
    return {
      fileName: this._srcFile.fileName,
      start: this.getCoordinates(node.getStart())!,
      end: this.getCoordinates(node.getEnd())!,
    };
  }

  private getResolvedType(node: ts.Node): ts.Type | undefined {
    const symbol = this._checker.getSymbolAtLocation(node);
    return symbol
      ? this._checker.getTypeOfSymbolAtLocation(symbol, symbol.declarations![0])
      : undefined;
  }

  private findDeclarationFile(symbol: ts.Symbol): ts.SourceFile | undefined {
    let node = symbol.declarations![0] as ts.Node;
    while (node?.parent) {
      node = node.parent;
    }
    return ts.isSourceFile(node) ? node : undefined;
  }

  private transformProps(section: EmittedSection, node: ts.ClassDeclaration) {
    const category = this.isContract(node) ? 'contract' : 'library';

    node.members.forEach((m) => {
      if (m.kind === ts.SyntaxKind.PropertyDeclaration) {
        section.appendWith(this, (memSec) => {
          return this.transformPropertyDeclaration(m as ts.PropertyDeclaration, memSec, category);
        });
      }
    });
  }

  private checkPropsOverride(node: ts.ClassDeclaration, baseContract: ts.ClassDeclaration) {
    const baseContractProps = baseContract.members
      .filter((m) => Transpiler.isProperty(m))
      .map((m) => m.name!.getText());
    node.members.forEach((m) => {
      if (Transpiler.isProperty(m)) {
        if (baseContractProps.includes(m.name!.getText())) {
          throw new TranspileError(
            `Untransformable property: '${m.name!.getText()}', already defined in base contract '${baseContract.name!.getText()}'`,
            this.getRange(node),
          );
        }
      }
    });
  }

  private checkMethodsOverride(node: ts.ClassDeclaration, baseContract: ts.ClassDeclaration) {
    const baseContractMethods = baseContract.members
      .filter((m) => Transpiler.isMethod(m))
      .map((m) => m.name!.getText());
    node.members.forEach((m) => {
      if (Transpiler.isMethod(m)) {
        if (baseContractMethods.includes(m.name!.getText())) {
          throw new TranspileError(
            `Untransformable method: '${m.name!.getText()}', already defined in base contract '${baseContract.name!.getText()}'`,
            this.getRange(node),
          );
        }
      }
    });
  }

  private transformMethods(section: EmittedSection, node: ts.ClassDeclaration) {
    const category = this.isContract(node) ? 'contract' : 'library';
    node.members.forEach((m) => {
      if (m.kind === ts.SyntaxKind.MethodDeclaration) {
        section.appendWith(this, (memSec) => {
          return this.transformMethodDeclaration(m as ts.MethodDeclaration, memSec, category);
        });
      }
    });
  }

  private transformClassDeclaration(node: ts.ClassDeclaration): EmittedSection {
    const className = node.name!.getText();

    this._currentContract = node;
    // also add it to local type symbols
    this._localTypeSymbols.set(className, this._checker.getSymbolAtLocation(node.name!)!);

    const stateTypeSymbol = this._stateTypeSymbols.get(className);
    if (stateTypeSymbol) {
      if (stateTypeSymbol.declarations[0].getSourceFile() === node.getSourceFile()) {
        this._localTypeSymbols.set(stateTypeSymbol.name, stateTypeSymbol);
      } else {
        this._importedTypeSymbols.set(stateTypeSymbol.name, stateTypeSymbol);
      }
    }

    const category = this.isContract(node) ? 'contract' : 'library';

    const baseContract = this.currentbaseContract;

    // Preprocess all methods

    const section = new EmittedSection();

    try {
      this.checkLiteralStateType();
      this.initAllPropInfos();
      this.initAllMethodInfos();

      this.injectScryptStructs(section);

      section
        .append('\n')
        .append(`\n${category} `)
        .append(`${className} {`, this.getCoordinates(node.name!.getStart()))
        .appendWith(
          this,
          (membersSection) => {
            if (baseContract) {
              this.checkPropsOverride(node, baseContract);
              this.transformProps(membersSection, baseContract);
            }

            this.transformProps(membersSection, node);

            this.injectScryptProps(membersSection);

            this.transformConstructor(membersSection, node, baseContract);

            if (baseContract) {
              this.checkMethodsOverride(node, baseContract);
              this.transformMethods(membersSection, baseContract);
            }

            this.transformMethods(membersSection, node);

            if (this.isStateful()) {
              this.injectSerializeStateFunc(membersSection);
            }

            // if (this.accessChange()) {
            //   membersSection.append(`\n${BUILD_CHANGE_OUTPUT_FUNCTION}`);
            // }

            if (this.getPublicMethodCount() === 0 && category === 'contract') {
              throw new TranspileError(
                'A `SmartContract` should have at least one public `@method`',
                this.getRange(node.name!),
              );
            }
            return membersSection;
          },
          true,
        )

        .append('\n}');

      const methodInfos = Array.from(this.methodInfos, ([key, methodInfo]) => ({ key, methodInfo }))
        .filter((i) => i.key.startsWith(`${className}.`))
        .filter((i) => i.methodInfo.codeSeparatorCount > 0);

      if (methodInfos.length > 1) {
        throw new TranspileError(
          `insertCodeSeparator() can only be called by one pulic method`,
          this.getRange(node),
        );
      }
    } catch (error) {
      if (error instanceof TranspileError) {
        section.errors.push(error);
      } else {
        throw error;
      }
    }
    return section;
  }

  private injectScryptProps(section: EmittedSection) {
    if (this.shouldInjectSHPreimageProp()) {
      section.append(`\nSHPreimage ${InjectedProp_SHPreimage};`);
    }
    if (this.shouldInjectChangeProp()) {
      section.append(`\nTxOut ${InjectedProp_ChangeInfo};`);
    }
    if (this.shouldInjectPrevoutsProp()) {
      section.append(`\nbytes ${InjectedProp_PrevoutsCtx};`);
    }
    if (this.shouldInjectPrevoutProp()) {
      section.append(`\nOutpoint ${InjectedProp_Prevout};`);
    }
    if (this.shouldInjectSpentScriptsProp()) {
      section.append(`\nbytes ${InjectedProp_SpentScriptHashes};`);
    }
    if (this.shouldInjectSpentAmountsProp()) {
      section.append(`\nbytes ${InjectedProp_SpentAmounts};`);
    }
    if (this.shouldInjectSpentDataHashesProp()) {
      section.append(`\nbytes ${InjectedProp_SpentDataHashes};`);
    }
    if (this.shouldInjectPrevTxHashPreimageProp()) {
      section.append(`\nTxHashPreimage ${InjectedProp_PrevTxHashPreimage};`);
    }
    if (this.shouldInjectCurStateProp()) {
      const stateTypeSymbol = this._stateTypeSymbols.get(this.currentContractName);
      if (!stateTypeSymbol) {
        throw new Error('State type symbol is not defined');
      }
      section.append(`\n${stateTypeSymbol!.name} ${InjectedProp_NextState};`);
    }
  }

  private injectScryptStructs(_section: EmittedSection) { }

  private injectSerializeStateFunc(section: EmittedSection) {
    const stateTypeSymbol = this._stateTypeSymbols.get(this.currentContractName);

    if (!stateTypeSymbol) {
      throw new Error('State type symbol is not defined');
    }

    const flattenProps = (prop: ts.Symbol, prefix: string): { name: string; type: ts.Type }[] => {
      const dec =
        prop.flags & ts.SymbolFlags.Alias
          ? this._checker.getAliasedSymbol(prop).declarations![0]
          : prop.declarations![0];

      let members: ts.NodeArray<ts.TypeElement>;

      // interface StateA {count: Int32}; SmartContract<StateA>
      if (ts.isInterfaceDeclaration(dec)) {
        members = dec.members;
      }
      // SmartContract<{count: Int32}>
      if (ts.isTypeLiteralNode(dec)) {
        members = dec.members;
      }
      // type StateA = {count: Int32}; SmartContract<StateA>
      if (ts.isTypeAliasDeclaration(dec) && ts.isTypeLiteralNode(dec.type)) {
        members = dec.type.members;
      }

      // state type must be a struct type
      if (!members && prefix === InjectedParam_CurState) {
        throw new Error(`State type must extends StructObject`);
      }

      // is a primitive type, just return
      const type = this._checker.getTypeAtLocation(dec);
      const typeStr = this.type2ResolvedName(type);
      if (allowedTypeStr(typeStr)) {
        return [
          {
            name: prefix,
            type,
          },
        ];
      }

      const flattenFixedArray = (type: ts.Type, prefix: string) => {
        const len = type.aliasTypeArguments![1];
        if (len.isNumberLiteral()) {
          return Array.from({ length: len.value }).flatMap((_, i) => {
            const elemType = type.aliasTypeArguments![0];
            const typeStr = this.type2ResolvedName(elemType);

            if (elemType.aliasSymbol?.name === 'FixedArray') {
              // fixed array type under fixed array type
              return flattenFixedArray(elemType, `${prefix}[${i}]`);
            } else {
              // non-fixed array types under fixed array type
              const symbol = elemType.aliasSymbol || elemType.symbol;
              if (!symbol) {
                if (allowedTypeStr(typeStr)) {
                  // compatible with bigint, boolean, string
                  return [
                    {
                      name: `${prefix}[${i}]`,
                      type: elemType,
                    },
                  ];
                } else {
                  throw new Error(`Unsupported type for prop hash: ${prefix}[${i}]: ${typeStr}`);
                }
              } else {
                return flattenProps(symbol, `${prefix}[${i}]`);
              }
            }
          });
        } else {
          throw new Error(`Unsupported type for prop hash: ${prefix}[index]: ${typeStr}`);
        }
      };

      if (!members) {
        // not a struct type, throw error
        throw new Error(`Unsupported type for prop hash: ${prop.name}: ${typeStr}`);
      } else {
        // is a struct type, do recursive flatten for each member
        return members.flatMap((m) => {
          const k = m.name.getText();
          const type = this._checker.getTypeAtLocation(m);
          const typeStr = this.type2ResolvedName(type);

          if (type.aliasSymbol?.name === 'FixedArray') {
            // fixed array type under struct type
            return flattenFixedArray(type, `${prefix}.${k}`);
          } else {
            // non-fixed array types under struct type
            const symbol = type.aliasSymbol || type.symbol;
            if (!symbol) {
              if (allowedTypeStr(typeStr)) {
                // compatible with bigint, boolean, string
                return [
                  {
                    name: `${prefix}.${k}`,
                    type,
                  },
                ];
              } else {
                throw new Error(`Unsupported type for prop hash: ${prefix}.${k}: ${typeStr}`);
              }
            }
            return flattenProps(symbol, `${prefix}.${k}`);
          }
        });
      }
    };

    function allowedTypeStr(typeStr: string) {
      try {
        propHash('dummyName', typeStr);
        return true;
      } catch (_e) {
        return false;
      }
    }

    function byteStringify(name: string, typeStr: string): string {
      switch(typeStr) {
        case 'Int32': 
        case 'SigHashType':
        case 'bigint': 
          return `pack(${name})`;
        case 'Bool':
        case 'boolean': 
          return `(${name} ? b'01' : b'')`;
        case 'ByteString':
        case 'Sha256':
        case 'Sha1':
        case 'Sig':
        case 'PubKey':
        case 'Ripemd160':
        case 'OpCodeType':
        case 'string':
          return `${name}`;
        default: {
          throw new Error(`Unsupported type for byteStringify: ${typeStr}`);
        }
      }
    }

    function propHash(name: string, typeStr: string): string {
      switch (typeStr) {
        case 'Int32':
        case 'SigHashType':
        case 'bigint':
          return `hash160(pack(${name}))`;
        case 'Bool':
        case 'boolean':
          return `hash160(${name} ? b'01' : b'')`;
        case 'ByteString':
        case 'Sha256':
        case 'Sha1':
        case 'Sig':
        case 'PubKey':
        case 'Ripemd160':
        case 'OpCodeType':
        case 'string':
          return `hash160(${name})`;
        default: {
          throw new Error(`Unsupported type for prop hash: ${typeStr}`);
        }
      }
    }

    const hashes = flattenProps(stateTypeSymbol, InjectedParam_CurState).map(({ name, type }) =>
      propHash(name, this.type2ResolvedName(type)),
    );
    const dataPart = flattenProps(stateTypeSymbol, InjectedParam_CurState).map(({ name, type }) =>
    {
      const bytes = byteStringify(name, this.type2ResolvedName(type));
      return `num2bin(len(${bytes}), 2) + ${bytes}`;
      // return `StdUtils.writeVarint(${bytes})`;
    }
    );

    section
      .append('\n')
      .append(
        `static function serializeState(${stateTypeSymbol.name} ${InjectedParam_CurState}): bytes {`,
      )
      .append('\n')
      .append(`  return ${dataPart.join(' + ')} + hash160(${hashes.join(' + ')});`)
      .append('\n')
      .append('}')
      .append('\n')
      .append(`static function stateHash(${stateTypeSymbol.name} ${InjectedParam_CurState}): bytes {`)
      .append('\n')
      .append(`  return sha256(${dataPart.join(' + ')} + hash160(${hashes.join(' + ')}));`)
      .append('\n')
      .append('}');
  }

  private transformPropertySignature(
    node: ts.PropertySignature,
    toSection: EmittedSection,
  ): EmittedSection {
    return this.transformEnclosingTypeNode(node.type || node, toSection)
      .append(` ${node.name.getText()}`, this.getCoordinates(node.name.getStart()))
      .append(';');
  }

  private transformPropertyDeclaration(
    node: ts.PropertyDeclaration,
    toSection: EmittedSection,
    category: SmartContractCategory,
  ): EmittedSection {
    if (!Transpiler.isProperty(node)) return toSection;

    toSection.append('\n');

    if (Transpiler.isStateProperty(node)) {
      if (category === 'library') {
        const decorator = Transpiler.findDecorator(node, DecoratorName.Prop);
        throw new TranspileError(
          `Untransformable property: '${node.name.getText()}', \`@prop(true)\` is only allowed to be used in \`SmartContract\``,
          this.getRange(decorator!.expression),
        );
      }

      if (Transpiler.isStaticProperty(node)) {
        throw new TranspileError(
          `Untransformable property: '${node.name.getText()}', \`@prop(true)\` cannot be static`,
          this.getRange(node),
        );
      }

      if (hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)) {
        throw new TranspileError(
          `Untransformable property: '${node.name.getText()}', \`@prop(true)\` cannot be readonly`,
          this.getRange(node),
        );
      }

      toSection.append('@state ');
    } else if (Transpiler.isStaticProperty(node)) {
      if (!node.initializer) {
        throw new TranspileError(
          `Untransformable property: '${node.name.getText()}', static property shall be initialized when declared`,
          this.getRange(node),
        );
      }
    }

    toSection
      .appendWith(this, (toSec) => {
        return this.transformModifiers(node, toSec);
      })
      .appendWith(this, (toSec) => {
        if (!node.type) {
          throw new TranspileError(
            `Untransformable property: '${node.name.getText()}', all \`prop()\` should be typed explicitly`,
            this.getRange(node),
          );
        }

        return this.transformEnclosingTypeNode(node.type, toSec);
      })
      .append(` ${node.name.getText()}`, this.getCoordinates(node.name.getStart()));

    if (node.initializer) {
      if (Transpiler.isStaticProperty(node)) {
        toSection
          .append(' = ')
          .appendWith(this, (toSec) => {
            return this.transformExpression(node.initializer!, toSec);
          })
          .append(';');
        return toSection;
      } else {
        throw new TranspileError(
          `Untransformable property: '${node.name.getText()}', Non-static properties shall only be initialized in the constructor`,
          this.getRange(node.initializer),
        );
      }
    }

    toSection.append(';');

    return toSection;
  }

  private buildConstructorParametersMap(
    node: ts.ConstructorDeclaration,
    baseContract: ts.ClassDeclaration,
  ): void {
    function getSuperParameters() {
      const superStmt = node.body!.statements[0] as ts.ExpressionStatement;

      const callexpr = superStmt.expression as ts.CallExpression;

      if (
        callexpr.arguments[0] &&
        ts.isSpreadElement(callexpr.arguments[0]) &&
        callexpr.arguments[0].getText().endsWith('arguments')
      ) {
        return node.parameters;
      } else {
        return callexpr.arguments;
      }
    }

    const basector = this.getConstructor(baseContract);

    if (!basector) {
      return;
    }

    const superParameters = getSuperParameters();

    basector.parameters.forEach((parameter, index) => {
      const superParameter = superParameters[index];

      this._constructorParametersMap.set(parameter.name.getText(), superParameter);
    });
  }

  static accessSetConstructor(statements: ts.NodeArray<ts.Statement>) {
    return (
      statements.findIndex((statement) => {
        return (
          ts.isExpressionStatement(statement) &&
          statement.expression.kind === ts.SyntaxKind.CallExpression &&
          /^this\.init\(/.test(statement.expression.getText())
        );
      }) > -1
    );
  }

  private checkSuperStmt(node: ts.ConstructorDeclaration): void {
    const superStmt = node.body!.statements[0] as ts.ExpressionStatement;

    const callexpr = superStmt.expression as ts.CallExpression;

    if (!ts.isCallExpression(callexpr) || callexpr.expression.getText() !== 'super') {
      throw new TranspileError(
        `Constructors for derived classes must contain a \`super()\` call`,
        this.getRange(node),
      );
    }

    if (Transpiler.accessSetConstructor(node.body!.statements)) {
      throw new TranspileError(
        `Direct subclasses of \`SmartContract\` do not need to call \`this.init()\`.`,
        this.getRange(node),
      );
    }

    if (
      callexpr.arguments[0] &&
      ts.isSpreadElement(callexpr.arguments[0]) &&
      callexpr.arguments[0].getText().endsWith('arguments')
    ) {
      return;
    }

    if (node.parameters.length !== callexpr.arguments.length) {
      throw new TranspileError(
        `All parameters in the constructor must be passed to the \`super()\` call`,
        this.getRange(node),
      );
    }

    node.parameters.forEach((p, pIdx) => {
      const arg = callexpr.arguments[pIdx];

      if (arg.getText() !== p.name.getText()) {
        throw new TranspileError(
          `All parameters in the constructor must be passed to the \`super()\` call following their declaration order`,
          this.getRange(node),
        );
      }
    });
  }

  private checkSetConstructorStmt(node: ts.ConstructorDeclaration): void {
    const superStmt = node.body!.statements[0] as ts.ExpressionStatement;

    const callexpr = superStmt.expression as ts.CallExpression;

    if (!ts.isCallExpression(callexpr) || callexpr.expression.getText() !== 'super') {
      throw new TranspileError(
        `Constructors for derived classes must contain a \`super()\` call`,
        this.getRange(node),
      );
    }

    if (
      callexpr.arguments[0] &&
      ts.isSpreadElement(callexpr.arguments[0]) &&
      callexpr.arguments[0].getText().endsWith('arguments')
    ) {
      return;
    }

    if (node.parameters.length === callexpr.arguments.length) {
      return;
    }
  }

  private canBeImplicitConstructor(node: ts.ConstructorDeclaration): boolean {
    // Test if it can be an implicit constructor.
    let res = true;

    const ctorParamNames: string[] = [];
    node.parameters.forEach((p) => {
      const pText = p.name.getFullText().trim();
      ctorParamNames.push(pText);
    });

    node.body!.statements.slice(1).forEach((stmt) => {
      // For each statement in the constr check if its a property init stmt.
      // If not, the constructor cannot be implicit.
      const isPropSet = this.queryPropertyInitializedInStmt(stmt);
      if (!isPropSet) {
        res = false;
        return;
      }

      // If its a prop init stmt, then also check if the value being set is a
      // constructor parameter.
      if (!ts.isExpressionStatement(stmt) || !ts.isBinaryExpression(stmt.expression)) {
        res = false;
        return;
      }

      const exprName = stmt.expression.right.getFullText().trim();
      let found = false;
      for (const ctorParamName of ctorParamNames) {
        if (ctorParamName == exprName) {
          found = true;
          break;
        }
      }
      if (!found) {
        res = false;
        return;
      }
    });

    // Check the order of the ctor params compared to the order of prop declarations.
    const props = node.parent.members.filter((member) => Transpiler.isProperty(member));
    props.forEach((p) => {
      const pName = p.name!.getFullText().trim();
      const ctorParamName = ctorParamNames.shift();
      if (pName != ctorParamName) {
        res = false;
        return;
      }
    });

    // Check if the contract contains any non-props. It can still contain static (readonly) non-props.
    const nonProps = node.parent.members.filter(
      (member) => this.isNonProp(member) && !this.isStaticReadOnlyNonProp(member),
    );
    if (nonProps.length > 0) {
      res = false;
    }

    // Also check for VarIntReader properties.
    if (this.accessSHPreimage() || this.accessChange() || this.accessPrevouts()) {
      res = false;
    }

    return res;
  }

  private transformConstructorBody(section: EmittedSection, node: ts.ConstructorDeclaration) {
    const allProps = this.allPropertyDeclaration(node.parent);

    const initializedProps = [] as ts.PropertyDeclaration[];
    node.body!.statements.slice(1).forEach((stmt) => {
      section.append('\n').appendWith(
        this,
        (stmtsSec) => {
          const prop = this.queryPropertyInitializedInStmt(stmt);

          if (prop) {
            initializedProps.push(prop);

            if (!Transpiler.isProperty(prop)) {
              return stmtsSec; //allow but ignore Non-Prop Property
            }
          }

          return this.transformStatement(stmt, stmtsSec);
        },
        true,
      );
    });

    allProps.forEach((prop) => {
      if (!initializedProps.map((p) => p.name.getText()).includes(prop.name.getText())) {
        // allowed static const prop initialized
        if (!Transpiler.isStaticProperty(prop)) {
          throw new TranspileError(
            `property \`${prop.name.getText()}\` must be initialized in the constructor`,
            this.getRange(prop),
          );
        }
      }
    });

    return section;
  }

  private transformConstructor(
    section: EmittedSection,
    cls: ts.ClassDeclaration,
    baseContract: ts.ClassDeclaration | undefined,
  ) {
    this.checkConstructor(cls);

    const node = cls.members.find((m) => m.kind === ts.SyntaxKind.Constructor) as
      | ts.ConstructorDeclaration
      | undefined;

    if (node) {
      if (baseContract) {
        this.buildConstructorParametersMap(node, baseContract);
      }

      section.appendWith(this, (section) => {
        if (!node.body) {
          throw new TranspileError(`Missing function body`, this.getRange(node));
        }

        const tmpSection = new EmittedSection();
        tmpSection.lines = section.lines;
        tmpSection.errors = section.errors;

        tmpSection
          .append('\n')
          .append('constructor', this.getCoordinates(node.getStart()))
          .append('(')
          .appendWith(this, (psSec) => {
            node.parameters.forEach((p, pIdx) => {
              psSec.appendWith(this, (pSec) => {
                const sec = this.transformParameter(p, pSec);
                if (pIdx !== node.parameters.length - 1) {
                  sec.append(', ');
                }
                return sec;
              });
            });
            return psSec;
          })
          .append(') ');

        tmpSection
          .append('{')
          .appendWith(
            this,
            (sec) => {
              if (baseContract) {
                baseContract.members.forEach((member) => {
                  if (member.kind === ts.SyntaxKind.Constructor) {
                    this.transformConstructorBody(sec, member as ts.ConstructorDeclaration);
                  }
                });
              }

              return this.transformConstructorBody(sec, node);
            },
            true,
          )
          .append('\n}');

        // If the constructor can be implicit, we don't even have to transform it.
        if (this.canBeImplicitConstructor(node)) {
          section.errors = tmpSection.errors;
          return section;
        }
        return tmpSection;
      });
    } else {
      if (this.accessSHPreimage() || this.accessChange() || this.accessPrevouts()) {
        section.append(`\n${EMPTY_CONSTRUCTOR}`);
        return section;
      }
    }
    return section;
  }

  private setMethodDecOptions(methodDec: ts.Decorator) {
    const expression = methodDec.expression;

    // set default value for options
    this._currentMethodDecOptions = {
      autoCheckInputState: true,
    };

    if (ts.isCallExpression(expression) && expression.arguments[0]) {
      const argTxt = expression.arguments[0].getText();
      this._currentMethodDecOptions.autoCheckInputState =
        !/autoCheckInputState: false/.test(argTxt);
    }
  }

  private transformMethodDeclaration(
    node: ts.MethodDeclaration,
    toSection: EmittedSection,
    category: SmartContractCategory,
  ): EmittedSection {
    const methodDec = Transpiler.findDecorator(node, DecoratorName.Method);
    if (!methodDec) return toSection;

    const match = /^method\((.*)?\)$/.exec(methodDec.expression.getText());

    if (!match) {
      return toSection;
    }

    this.setMethodDecOptions(methodDec);
    this._currentMethodName = node.name.getText();

    let sigHashType = '41'; //SigHash.ALL;

    switch (match[1]) {
      case 'SigHash.ANYONECANPAY_SINGLE':
        sigHashType = 'c3'; // SigHash.ANYONECANPAY_SINGLE;
        break;
      case 'SigHash.ANYONECANPAY_ALL':
        sigHashType = 'c1'; //SigHash.ANYONECANPAY_ALL;
        break;
      case 'SigHash.ANYONECANPAY_NONE':
        sigHashType = 'c2'; //SigHash.ANYONECANPAY_NONE;
        break;
      case 'SigHash.ALL':
        sigHashType = '41'; //SigHash.ALL;
        break;
      case 'SigHash.SINGLE':
        sigHashType = '43'; //SigHash.SINGLE;
        break;
      case 'SigHash.NONE':
        sigHashType = '42'; //SigHash.NONE;
        break;
      default:
        break;
    }

    const isPublicMethod = Transpiler.isPublicMethod(node);
    if (isPublicMethod) {
      if (category === 'library') {
        const publicModifier = ts
          .getModifiers(node)!
          .find((m) => m.kind === ts.SyntaxKind.PublicKeyword);
        throw new TranspileError(
          `\`@method\` in \`SmartContractLib\` should not be declared as \`public\``,
          this.getRange(publicModifier ? publicModifier : node),
        );
      }

      const retStmt = findReturnStatement(node);
      if (retStmt) {
        throw new TranspileError(
          `public methods cannot contain an explicit return statement`,
          this.getRange(retStmt),
        );
      }

      if (node.type) {
        // has return type
        throw new TranspileError(
          `public methods cannot have a return type`,
          this.getRange(node.type),
        );
      }
    } else {
      if (!node.type) {
        throw new TranspileError(
          `non-public methods must declare the return type explicitly`,
          this.getRange(node),
        );
      }
    }

    if (!node.body) {
      throw new TranspileError(`Missing function body`, this.getRange(node));
    }

    const shouldAutoAppendSighashPreimage = this.shouldAutoAppendSighashPreimage(node);
    const shouldAutoAppendChangeAmount = this.shouldAutoAppendChangeAmount(node);
    const shouldAutoAppendPrevouts = this.shouldAutoAppendPrevouts(node);
    const shouldAutoAppendPrevout = this.shouldAutoAppendPrevout(node);
    const shouldAutoAppendSpentScripts = this.shouldAutoAppendSpentScripts(node);
    const shouldAutoAppendSpentAmounts = this.shouldAutoAppendSpentAmounts(node);
    const shouldAutoAppendSpentDataHashes = this.shouldAutoAppendSpentDataHashes(node);
    const shouldAutoAppendStateArgs = this.shouldAutoAppendStateArgs(node);
    const shouldAutoAppendPrevTxHashPreimage = this.shouldAutoAppendPrevTxHashPreimageArgs(node)

    const buildChangeOutputExpression = findBuildChangeOutputExpression(node);
    if (
      shouldAutoAppendSighashPreimage.shouldAppendArguments &&
      buildChangeOutputExpression !== undefined
    ) {
      const allowedSighashType = ['c1', '41']; // Only sighash ALL allowed.
      if (!allowedSighashType.includes(sigHashType)) {
        throw new TranspileError(
          `Can only use sighash ALL or ANYONECANPAY_ALL if using \`this.buildChangeOutput()\``,
          this.getRange(node),
        );
      }
    }

    toSection
      .append('\n')
      .appendWith(this, (toSec) => {
        return this.transformModifiers(node, toSec);
      })
      .append('function ')
      .append(node.name.getText(), this.getCoordinates(node.name.getStart()))
      .append('(')
      .appendWith(this, (psSec) => {
        // not allow SmartContract as parameter
        const inValidParams = node.parameters.find((p) => p.type?.getText() === 'SmartContract');

        if (inValidParams) {
          throw new TranspileError(
            `Untransformable parameter: '${node.getText()}'`,
            this.getRange(node),
          );
        }

        node.parameters.forEach((p, pIdx) => {
          psSec.appendWith(this, (pSec) => {
            const sec = this.transformParameter(p, pSec);
            if (pIdx !== node.parameters.length - 1) {
              sec.append(', ');
            }
            return sec;
          });
        });

        let paramLen = node.parameters.length;

        if (shouldAutoAppendSighashPreimage.shouldAppendArguments) {
          this._accessBuiltinsSymbols.add('SHPreimage');
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`SHPreimage ${InjectedParam_SHPreimage}`);
          paramLen += 2;
        }

        if (shouldAutoAppendChangeAmount.shouldAppendArguments) {
          this._accessBuiltinsSymbols.add('TxOut');
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`TxOut ${InjectedParam_ChangeInfo}`);
          paramLen += 2;
        }
        if (shouldAutoAppendStateArgs.shouldAppendArguments) {
          if (paramLen > 0) {
            psSec.append(', ');
          }
          const stateTypeSymbol = this._stateTypeSymbols.get(this.currentContractName);
          this._accessBuiltinsSymbols.add('StdUtils');
          if (!stateTypeSymbol) {
            throw new Error('State type symbol is not defined');
          }
          psSec.append(`${stateTypeSymbol!.name} ${InjectedParam_CurState}`);
          paramLen += 1;
        }

        // note this should be the third from bottom parameter if exists
        if (shouldAutoAppendPrevouts.shouldAppendArguments) {
          this._accessBuiltinsSymbols.add('Outpoint');
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`bytes ${InjectedParam_Prevouts}`);
          paramLen += 1;
        }

        // note this should be the second from bottom parameter if exists
        if (shouldAutoAppendSpentAmounts.shouldAppendArguments) {
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`bytes ${InjectedParam_SpentAmounts}`);
          paramLen += 1;
        }

        if (shouldAutoAppendSpentDataHashes.shouldAppendArguments) {
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`bytes ${InjectedParam_SpentDataHashes}`);
          paramLen += 1;
        }

        // note this should be the last parameter if exists
        if (shouldAutoAppendSpentScripts.shouldAppendArguments) {
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`bytes ${InjectedParam_SpentScriptHashes}`);
          paramLen += 1;
        }

        if (shouldAutoAppendPrevTxHashPreimage.shouldAppendArguments) {
          if (paramLen > 0) {
            psSec.append(', ');
          }
          psSec.append(`TxHashPreimage ${InjectedParam_PrevTxHashPreimage}`);
          paramLen += 1;
        }

        return psSec;
      })
      .append(') ');

    // non-public method return type
    let autoReturnStatement = '';
    if (!isPublicMethod) {
      // for non-public method, `node.type` is not `undefined` definitely
      if (node.type!.kind !== ts.SyntaxKind.VoidKeyword) {
        // return not void
        toSection
          .append(': ')
          .appendWith(this, (toSec) => this.transformEnclosingTypeNode(node.type!, toSec))
          .append(' ');
      } else {
        // return void
        toSection.append(': bool ');
        autoReturnStatement = '\n  return true;';
      }
    }
    this._accessBuiltinsSymbols.add('TxUtils');
    this._accessBuiltinsSymbols.add('ContextUtils');
    return toSection
      .append('{')
      .appendWith(
        this,
        (sec) => {
          if (shouldAutoAppendSighashPreimage.shouldAppendArguments) {
            sec
              .append('\n')
              .append(`${CALL_CHECK_SHPREIMAGE};`)
              .append(`\n`);
          }
          if (shouldAutoAppendSighashPreimage.shouldAppendThisAssignment) {
            sec.append(thisAssignment(InjectedProp_SHPreimage)).append('\n');
          }

          if (shouldAutoAppendChangeAmount.shouldAppendThisAssignment) {
            sec.append(`\n`).append(thisAssignment(InjectedProp_ChangeInfo)).append(`\n`);
          }

          
          if (shouldAutoAppendSpentAmounts.shouldAppendArguments) {
            sec
              .append('\n')
              .append(
                `int ${InjectedVar_InputCount} = ContextUtils.checkSpentAmounts(${InjectedParam_SpentAmounts}, ${InjectedParam_SHPreimage}.hashSpentAmounts);`,
              )
              .append('\n');
          }

          if (shouldAutoAppendPrevouts.shouldAppendArguments) {
            sec
              .append('\n')
              .append(
                `Outpoint ${InjectedProp_Prevout} = ContextUtils.checkPrevouts(${InjectedParam_Prevouts}, ${InjectedParam_SHPreimage}.hashPrevouts, ${InjectedParam_SHPreimage}.inputIndex, ${InjectedVar_InputCount});`,
              )
              .append('\n');
          }
          if (shouldAutoAppendPrevouts.shouldAppendThisAssignment) {
            sec.append(thisAssignment(InjectedProp_PrevoutsCtx)).append('\n');
          }
          if (shouldAutoAppendPrevout.shouldAppendThisAssignment) {
            sec.append(thisAssignment(InjectedProp_Prevout)).append('\n');
          }

          if (shouldAutoAppendSpentScripts.shouldAppendArguments) {
            sec
              .append('\n')
              .append(
                `ContextUtils.checkSpentScripts(${InjectedParam_SpentScriptHashes}, ${InjectedParam_SHPreimage}.hashSpentScriptHashes, ${InjectedVar_InputCount});`,
              )
              .append('\n');
          }
          if (shouldAutoAppendSpentScripts.shouldAppendThisAssignment) {
            sec.append(thisAssignment(InjectedProp_SpentScriptHashes)).append('\n');
          }


          if (shouldAutoAppendSpentDataHashes.shouldAppendArguments) {
            sec
              .append('\n')
              .append(
                `ContextUtils.checkSpentDataHashes(${InjectedParam_SpentDataHashes}, ${InjectedParam_SHPreimage}.hashSpentDataHashes, ${InjectedVar_InputCount});`,
              )
              .append('\n');
          }

          if (shouldAutoAppendStateArgs.shouldAppendArguments) {
            // append initialize next state
            const stateTypeSymbol = this._stateTypeSymbols.get(this.currentContractName);
            sec
              .append('\n')
              .append(
                `${stateTypeSymbol!.name} ${InjectedVar_NextState} = ${InjectedParam_CurState};`,
              )
              .append('\n');
            if (shouldAutoAppendStateArgs.shouldAppendThisAssignment) {
              sec
                .append('\n')
                .append(`${thisAssignment(InjectedVar_NextState)}`)
                .append('\n');
            }
          }

          if (
            shouldAutoAppendStateArgs.shouldAppendArguments &&
            this._currentMethodDecOptions.autoCheckInputState
          ) {
            // append checkInputState for current input

            const stateHash = this._stateTypeSymbols.has(this.currentContractName)
              ? `${this._currentContract.name.getText()}.stateHash(${InjectedParam_CurState})`
              : "b''";

            // here no need to access this, because it's in public function, the variable we access is in the arguments
            this._accessBuiltinsSymbols.add('StateUtils');
            sec
              .append('\n')
              .append(
                `StateUtils.checkInputState(${InjectedParam_SHPreimage}.inputIndex, ${stateHash}, ${InjectedParam_SpentDataHashes});`,
              )
              .append('\n');
          }

          if (shouldAutoAppendPrevTxHashPreimage.shouldAppendArguments) {
            sec
              .append('\n')
              .append(
                `Backtrace.checkPrevTxHashPreimage(${InjectedParam_PrevTxHashPreimage}, ${InjectedParam_Prevouts}, ${InjectedParam_SHPreimage}.inputIndex);`,
              )
              .append('\n');
          }
          if (shouldAutoAppendPrevTxHashPreimage.shouldAppendThisAssignment) {
            sec.append(thisAssignment(InjectedProp_PrevTxHashPreimage)).append('\n');
          }

          node.body!.statements.forEach((stmt) => {
            sec.append('\n').appendWith(
              this,
              (stmtsSec) => {
                return this.transformStatement(stmt, stmtsSec);
              },
              true,
            );
          });

          if (isPublicMethod) {
            if (!this.verifyLastAssertStatement(node.body!.statements)) {
              throw new TranspileError(
                `Untransformable public method: Public method \`${node.name.getText()}\` not ended with \`assert()\``,
                this.getRange(node),
              );
            }

            if (this.needAppendLastStatement(node.body!.statements)) {
              sec.append('\n').append('require(true);\n');
            }
          }

          return sec;
        },
        true,
      )
      .append(autoReturnStatement)
      .append('\n}');
  }

  private isAssertStatement(node: ts.Statement): boolean {
    if (ts.isExpressionStatement(node)) {
      const s = node as ts.ExpressionStatement;
      if (ts.isCallExpression(s.expression)) {
        const e = s.expression as ts.CallExpression;
        return e.expression.getText() === 'assert';
      }
    } else if (ts.isForStatement(node)) {
      return this.isForStatementAssert(node);
    } else if (ts.isIfStatement(node)) {
      return this.isIfStatementAssert(node);
    } else if (ts.isBlock(node)) {
      return this.isBlockStatementAssert(node);
    }
    return false;
  }

  private isBlockStatementAssert(node: ts.Statement): boolean {
    if (ts.isBlock(node)) {
      const block = node as ts.Block;

      if (block.statements.length === 0) {
        return false;
      }
      let i = block.statements.length - 1;
      while (i >= 0 && this.isConsoleLogStatement(block.statements[i])) {
        --i;
      }
      return i >= 0 && this.isAssertStatement(block.statements[i]);
    }
    return false;
  }

  private isForStatementAssert(node: ts.Statement): boolean {
    if (ts.isForStatement(node)) {
      const s = node as ts.ForStatement;
      return this.isAssertStatement(s.statement);
    }
    return false;
  }

  private isIfStatementAssert(node: ts.Statement): boolean {
    if (ts.isIfStatement(node)) {
      const s = node as ts.IfStatement;

      if (s.elseStatement) {
        return this.isAssertStatement(s.thenStatement) && this.isAssertStatement(s.elseStatement);
      }

      return false;
    }
    return false;
  }

  private isConsoleLogStatement(node: ts.Statement): boolean {
    if (ts.isExpressionStatement(node)) {
      const s = node as ts.ExpressionStatement;
      return (
        s.expression.kind === ts.SyntaxKind.CallExpression &&
        /^console\.log/.test(s.expression.getText())
      );
    }
    return false;
  }

  private verifyLastAssertStatement(statements: ts.NodeArray<ts.Statement>) {
    if (statements.length === 0) {
      return false;
    }
    let i = statements.length - 1;
    while (i >= 0 && this.isConsoleLogStatement(statements[i])) {
      --i;
    }
    return i >= 0 && this.isAssertStatement(statements[i]);
  }

  private needAppendLastStatement(statements: ts.NodeArray<ts.Statement>) {
    if (statements.length === 0) {
      return false;
    }
    let i = statements.length - 1;
    while (i >= 0 && this.isConsoleLogStatement(statements[i])) {
      --i;
    }
    return i >= 0 && !ts.isExpressionStatement(statements[i]);
  }

  private hasPropertyAccessExpression(node: ts.Node, propName: string): true | undefined {
    if (ts.isPropertyAccessExpression(node)) {
      const ae = node as ts.PropertyAccessExpression;
      if (ae.expression.getText() === 'this' && ae.name.getText() === propName) {
        return true;
      }
    }
    return ts.forEachChild(node, (node) => this.hasPropertyAccessExpression(node, propName));
  }

  private hasFunctionCallExpression(node: ts.Node, funcName: string): true | undefined {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.expression.getText() === 'this' &&
        callee.name.getText() === funcName
      ) {
        return true;
      }
    }
    return ts.forEachChild(node, (node) => this.hasFunctionCallExpression(node, funcName));
  }

  private createMethodAccessInfo(
    method: ts.MethodDeclaration,
    currentMethodName: string,
    isBase: boolean,
  ): AccessInfo {
    const accessInfo: AccessInfo = {
      accessSHPreimage: false,
      accessSHPreimageInSubCall: false,
      accessChange: false,
      accessChangeInSubCall: false,
      accessState: false,
      accessStateInSubCall: false,
      accessPrevouts: false,
      accessPrevoutsInSubCall: false,
      accessPrevout: false,
      accessPrevoutInSubCall: false,
      accessSpentScripts: false,
      accessSpentScriptsInSubCall: false,
      accessSpentAmounts: false,
      accessSpentAmountsInSubCall: false,
      accessSpentDataHashes: false,
      accessSpentDataHashesInSubCall: false,
      accessBacktrace: false,
      accessBacktraceInSubCall: false,
      accessCLTV: false,
    };

    function vistMethodChild(self: Transpiler, node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        // access properties under `this.ctx`
        if (node.expression.getText() === 'this.ctx') {
          Object.assign(accessInfo, {
            accessSHPreimage: true,
          });
          switch (node.name.getText()) {
            case 'prevouts':
              Object.assign(accessInfo, {
                accessPrevouts: true,
                accessSpentAmounts: true,
              });
              break;
            case 'prevout':
              Object.assign(accessInfo, {
                accessPrevout: true,
                accessSpentAmounts: true,
              });
              break;
            case 'spentAmounts':
              Object.assign(accessInfo, {
                accessSpentAmounts: true,
              });
              break;
            case 'spentScriptHashes':
              Object.assign(accessInfo, {
                accessSpentAmounts: true,
                accessSpentScripts: true,
              });
              break;
            case 'spentDataHashes':
              Object.assign(accessInfo, {
                accessSpentAmounts: true,
                accessSpentDataHashes: true,
              });
              break;
          }
        }
        // access properties under `this`
        if (node.expression.getText() === 'this') {
          if (node.name.getText() === 'changeInfo') {
            Object.assign(accessInfo, {
              accessChange: true,
            });
          } else if (node.name.getText() === 'state') {
            Object.assign(accessInfo, {
              accessSHPreimage: true, // accessSpentDataHashes depends on shPreimage
              accessState: true,
              accessSpentAmounts: true, // spentDataHashes depends on spentAmounts
              accessSpentDataHashes: true, // state depends on spentDataHashes
            });
          } else if (node.name.getText() ==='ctx') {
            Object.assign(accessInfo, {
              accessSHPreimage: true, // accessSpentDataHashes depends on shPreimage
            });
          }
        }
      } else if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee) && callee.expression.getText() === 'this') {
          const methodName = callee.name.getText();
          if (methodName === currentMethodName) {
            throw new TranspileError(
              `Cycle detected in function call: this.${methodName}()!`,
              self.getRange(node),
            );
          } else if (SmartContractBuiltinMethods.includes(methodName)) {
            if (methodName === 'buildChangeOutput') {
              Object.assign(accessInfo, {
                accessChange: true,
              });
            } else if (methodName === 'checkInputState') {
              Object.assign(accessInfo, {
                accessSHPreimage: true, // accessSpentDataHashes depends on shPreimage
                accessState: true,
                accessSpentDataHashes: true,
              });
            } else if (['timeLock'].includes(methodName)) {
              Object.assign(accessInfo, {
                accessSHPreimage: true,
                accessCLTV: true,
              });
            }  else if (['checkOutputs'].includes(methodName)) {
              Object.assign(accessInfo, {
                accessSHPreimage: true,
              });
            } else if (['backtraceToOutpoint', 'backtraceToScript'].includes(methodName)) {
              Object.assign(accessInfo, {
                accessSHPreimage: true,
                accessPrevouts: true,
                accessSpentScripts: true,
                accessSpentAmounts: true,
                accessBacktrace: true,
              });
            }
          } else {
            // access in subCall method
            const clsName = Transpiler.getClassDeclaration(node)!.name!.getText();
            let methodInfo = self.methodInfos.get(`${clsName}.${methodName}`);

            if (!methodInfo) {
              const m = self.findMethodDeclaration(methodName);
              if (!m) {
                const msg = `\`${methodName}\` is not \`@method\` decorated so cannot be called in \`${currentMethodName}\`.`;
                throw new TranspileError(msg, self.getRange(callee.name));
              }

              methodInfo = self.createMethodInfo(m, currentMethodName, isBase);

              if (!methodInfo) {
                throw new TranspileError('createMethodInfo failed', self.getRange(callee.name));
              }
            }
            Transpiler.checkAccessInSubCall(
              currentMethodName,
              self.getRange(callee.name),
              methodInfo,
            );
            Transpiler.pickAccessInfo(accessInfo, methodInfo.accessInfo);
          }
        }
      }

      ts.forEachChild(node, (node) => vistMethodChild(self, node));
    }

    vistMethodChild(this, method);

    return accessInfo;
  }

  private static checkAccessInSubCall(
    calleeMethod: string,
    calleeRange: Range,
    subCallMethodInfo: MethodInfo,
  ) {
    if (subCallMethodInfo.isPublic) {
      // public function with access to injected arguments cannot be called by another function
      const accessInfo = subCallMethodInfo.accessInfo;

      const getErrorMsg = () =>
        `\`${calleeMethod}\` cannot call public function \`${subCallMethodInfo.name}\`, because public function \`${subCallMethodInfo.name}\` has access to \`this.ctx\`, \`this.state\`, \`this.changeInfo\`, or \`backtrace\``;

      if (accessInfo.accessSHPreimage) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }

      if (accessInfo.accessChange) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessState) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessPrevouts) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessSpentAmounts) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessSpentScripts) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessSpentDataHashes) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
      if (accessInfo.accessBacktrace) {
        throw new TranspileError(getErrorMsg(), calleeRange);
      }
    }
  }

  private static pickAccessInfo(target: AccessInfo, info: AccessInfo) {
    return Object.keys(info).reduce((acc, current) => {
      if (info[current] === true) {
        Object.assign(acc, {
          [current]: info[current],
        });
        Object.assign(acc, {
          [current + 'InSubCall']: info[current],
        });
      }
      return acc;
    }, target);
  }
  private initAllMethodInfos() {
    if (this.currentbaseContract) {
      this.currentbaseContract.members.forEach((m) => {
        if (Transpiler.isMethod(m)) {
          this.createMethodInfo(m as ts.MethodDeclaration, m.name!.getText(), true);
        }
      });
    }

    this._currentContract.members.forEach((m) => {
      if (Transpiler.isMethod(m)) {
        this.createMethodInfo(m as ts.MethodDeclaration, m.name!.getText(), false);
      }
    });
  }

  private initAllPropInfos() {
    if (this.currentbaseContract) {
      this.currentbaseContract.members.forEach((m) => {
        if (Transpiler.isProperty(m)) {
          this.createPropInfo(m as ts.PropertyDeclaration, true);
        }
      });
    }

    this._currentContract.members.forEach((m) => {
      if (Transpiler.isProperty(m)) {
        this.createPropInfo(m as ts.PropertyDeclaration, false);
      }
    });
  }

  createMethodInfo(
    m: ts.MethodDeclaration,
    currentMethodName: string,
    isBase: boolean,
  ): MethodInfo | undefined {
    //save methods info
    const cls = Transpiler.getClassDeclaration(m);

    if (!cls) {
      throw new TranspileError(`getClassDeclaration undefined`, this.getRange(m.name));
    }

    const key = `${cls.name!.getText()}.${m.name.getText()}`;

    if (!this.methodInfos.has(key)) {
      const methodInfo = {
        isPublic: Transpiler.isPublicMethod(m),
        isBase: isBase,
        accessInfo: this.createMethodAccessInfo(m, currentMethodName, isBase),
        name: m.name.getText(),
        codeSeparatorCount: 0,
      };
      this.methodInfos.set(key, methodInfo);
    }

    return this.methodInfos.get(key);
  }

  createPropInfo(m: ts.PropertyDeclaration, isBase: boolean): PropInfo | undefined {
    const cls = Transpiler.getClassDeclaration(m);

    if (!cls) {
      throw new Error('No ClassDeclaration found!');
    }

    //save prop info
    const key = `${cls.name!.getText()}.${m.name.getText()}`;

    if (!this.propInfos.has(key)) {
      const propInfo: PropInfo = {
        name: m.name.getText(),
        isState: Transpiler.isStateProperty(m),
        isStatic: Transpiler.isStaticProperty(m),
        isReadonly: Transpiler.isReadonlyProperty(m),
        isBase: isBase,
        isCTC: this.isCtcDeclaration(m),
      };
      this.propInfos.set(key, propInfo);
    }

    return this.propInfos.get(key);
  }

  // TODO: don't support override now
  private findMethodInfo(name: string): MethodInfo | undefined {
    const methodInfo = this.methodInfos.get(`${this.currentContractName}.${name}`);

    if (methodInfo) {
      return methodInfo;
    }

    if (this.currentbaseContract) {
      const methodInfo = this.methodInfos.get(`${this.currentbaseContractName}.${name}`);

      if (methodInfo) {
        return methodInfo;
      }
    }

    return undefined;
  }

  private getMethodContainsTheNode(node: ts.Node) {
    let methodNode: ts.MethodDeclaration | undefined;
    let _node = node;

    const baseContractNode = this.currentbaseContract;

    while (_node.parent.parent) {
      // current contract
      if (this.scComponents.includes(_node.parent.parent as ClassDeclaration)) {
        methodNode = _node.parent as MethodDeclaration;
        break;
      }
      // base contract
      if (_node.parent.parent === baseContractNode) {
        methodNode = _node.parent as MethodDeclaration;
        break;
      }
      _node = _node.parent;
    }
    if (!methodNode) {
      throw new TranspileError(
        `Cannot find the method that contains the \`${node.getText()}\``,
        this.getRange(node),
      );
    }
    return methodNode;
  }

  private getCtxMethodInfos(isPublic: boolean = true): Array<MethodInfo> {
    return Array.from(this.methodInfos.values()).filter(
      (info) => info.accessInfo.accessSHPreimage && info.isPublic === isPublic,
    );
  }

  private findPropInfo(name: string): PropInfo | undefined {
    const propInfo = this.propInfos.get(`${this.currentContractName}.${name}`);

    if (propInfo) {
      return propInfo;
    }

    if (this.currentbaseContract) {
      const propInfo = this.propInfos.get(`${this.currentbaseContractName}.${name}`);

      if (propInfo) {
        return propInfo;
      }
    }

    return undefined;
  }

  private getStatePropInfos(): Array<PropInfo> {
    return Array.from(this.propInfos.values()).filter((info) => info.isState);
  }

  private getPublicMethodCount() {
    let count = 0;
    this.methodInfos.forEach((info) => {
      if (info.isPublic) {
        count++;
      }
    });
    return count;
  }

  /**
   * does the current contract have a method to access CTX
   * @returns
   */
  private accessSHPreimage() {
    let ret = false;
    this.methodInfos.forEach((info) => {
      if (info.accessInfo.accessSHPreimage) {
        ret = true;
      }
    });
    return ret;
  }

  private checkShouldInject(methodCheckFn: (node: ts.MethodDeclaration) => boolean): boolean {
    // do not inject if the current contract is a library
    if (this.isLibrary(this._currentContract)) return false;
    let ret = false;

    this._currentContract.members.forEach((member) => {
      if (member.kind === ts.SyntaxKind.MethodDeclaration) {
        const method = member as ts.MethodDeclaration;

        // do not inject if the method is not decorated with @method
        const methodDec = Transpiler.findDecorator(method, DecoratorName.Method);
        if (!methodDec) return;
        const match = /^method\((.*)?\)$/.exec(methodDec.expression.getText());
        if (!match) {
          return;
        }
        // do not inject if the method is not public
        if (!Transpiler.isPublicMethod(method)) return;
        // do not inject if the method is static
        if (Transpiler.isStaticMethod(method)) return;

        try {
          if (methodCheckFn(method)) {
            ret = true;
          }
        } catch (_e) {
          // ignore error
        }
      }
    });
    return ret;
  }

  private shouldInjectSHPreimageProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendSighashPreimage(method).shouldAccessThis,
    );
  }

  private shouldInjectChangeProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendChangeAmount(method).shouldAccessThis,
    );
  }

  private shouldInjectPrevoutsProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendPrevouts(method).shouldAccessThis,
    );
  }

  private shouldInjectPrevoutProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendPrevout(method).shouldAccessThis,
    );
  }

  private shouldInjectSpentScriptsProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendSpentScripts(method).shouldAccessThis,
    );
  }

  private shouldInjectSpentAmountsProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendSpentAmounts(method).shouldAccessThis,
    );
  }

  private shouldInjectSpentDataHashesProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendSpentDataHashes(method).shouldAccessThis,
    );
  }

  private shouldInjectPrevTxHashPreimageProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendPrevTxHashPreimageArgs(method).shouldAccessThis,
    );
  }

  private shouldInjectCurStateProp() {
    return this.checkShouldInject(
      (method) => this.shouldAutoAppendStateArgs(method).shouldAccessThis,
    );
  }

  private isStateful() {
    return this._stateTypeSymbols.has(this.currentContractName);
  }

  private accessChange() {
    let ret = false;
    this.methodInfos.forEach((info) => {
      if (info.isPublic && info.accessInfo.accessChange) {
        ret = true;
      }
    });
    return ret;
  }

  private accessPrevouts() {
    let ret = false;
    this.methodInfos.forEach((info) => {
      if (info.isPublic && info.accessInfo.accessPrevouts) {
        ret = true;
      }
    });
    return ret;
  }

  private _shouldAutoAppend(
    node: ts.MethodDeclaration,
    shouldFn: (methodInfo: MethodInfo) => [boolean, boolean, boolean],
  ) {
    const methodInfo = this.findMethodInfo(node.name.getText());
    if (!methodInfo) {
      throw new UnknownError(
        `No method info found for \`${node.name.getText()}\``,
        this.getRange(node.name),
      );
    }
    const [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis] =
      shouldFn(methodInfo);

    // addtional check: if a private method is accessing , but no public method is accessing, then it should not be injected and throw an error
    if (shouldAccessThis && !methodInfo.isPublic) {
      let addtionalCheckPassed = shouldAccessThis ? false : true;
      for (const info of this.methodInfos.values()) {
        const [shouldAppendArguments_] = shouldFn(info);
        if (info.isPublic && shouldAppendArguments_) {
          addtionalCheckPassed = true;
          break;
        }
      }

      if (!addtionalCheckPassed) {
        throw new TranspileError(
          `Cannot access \`this.ctx\`, \`this.state\`, \`this.changeInfo\`, or \`backtrace\` in a private method \`${node.name.getText()}\`, because the private method is not called by any public method`,
          this.getRange(node.name),
        );
      }
    }

    return { shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis };
  }

  private shouldAutoAppendChangeAmount(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessChange, accessChangeInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessChange && isPublic;
      const shouldAppendThisAssignment = accessChange && accessChangeInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessChangeInSubCall) && accessChange;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendPrevouts(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessPrevouts, accessPrevoutsInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessPrevouts && isPublic;
      const shouldAppendThisAssignment = accessPrevouts && accessPrevoutsInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessPrevoutsInSubCall) && accessPrevouts;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendPrevout(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessPrevout, accessPrevoutInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessPrevout && isPublic;
      const shouldAppendThisAssignment = accessPrevout && accessPrevoutInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessPrevoutInSubCall) && accessPrevout;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendSpentScripts(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessSpentScripts, accessSpentScriptsInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessSpentScripts && isPublic;
      const shouldAppendThisAssignment =
        accessSpentScripts && accessSpentScriptsInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessSpentScriptsInSubCall) && accessSpentScripts;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendSpentAmounts(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessSpentAmounts, accessSpentAmountsInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessSpentAmounts && isPublic;
      const shouldAppendThisAssignment =
        accessSpentAmounts && accessSpentAmountsInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessSpentAmountsInSubCall) && accessSpentAmounts;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendSpentDataHashes(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessSpentDataHashes, accessSpentDataHashesInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessSpentDataHashes && isPublic;
      const shouldAppendThisAssignment = accessSpentDataHashes && accessSpentDataHashesInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessSpentDataHashesInSubCall) && accessSpentDataHashes;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendStateArgs(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessState, accessStateInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;

      const shouldAppendArguments = accessState && isPublic;
      const shouldAppendThisAssignment = accessState && accessStateInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessStateInSubCall) && accessState;

      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }

  private shouldAutoAppendPrevTxHashPreimageArgs(node: ts.MethodDeclaration) {
    return this._shouldAutoAppend(node, (methodInfo) => {
      const { accessBacktrace, accessBacktraceInSubCall } = methodInfo.accessInfo;
      const { isPublic } = methodInfo;
      const shouldAppendArguments = accessBacktrace && isPublic;
      const shouldAppendThisAssignment = accessBacktrace && accessBacktraceInSubCall && isPublic;
      const shouldAccessThis = (!isPublic || accessBacktraceInSubCall) && accessBacktrace;
      return [shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis];
    });
  }


  static isStaticMethod(node: ts.Node) {
    if (ts.isMethodDeclaration(node) && hasModifier(node, ts.SyntaxKind.StaticKeyword)) {
      return true;
    }

    return false;
  }

  static isPublicMethod(node: ts.Node) {
    if (
      ts.isMethodDeclaration(node) &&
      hasModifier(node, ts.SyntaxKind.PublicKeyword) &&
      this.findDecorator(node, DecoratorName.Method)
    ) {
      return true;
    }
    return false;
  }

  private shouldAutoAppendSighashPreimage(node: ts.MethodDeclaration) {
    // const hasSigHashPreimageParameters = node.parameters.find(
    //   (p) => p.type?.getText() === 'SigHashPreimage',
    // );

    // if (hasSigHashPreimageParameters) {
    //   return false;
    // }

    const methodInfo = this.findMethodInfo(node.name.getText());

    if (!methodInfo) {
      throw new UnknownError(
        `No method info found for \`${node.name.getText()}\``,
        this.getRange(node.name),
      );
    }
    const { accessSHPreimage, accessSHPreimageInSubCall } = methodInfo.accessInfo;
    const { isPublic } = methodInfo;

    const shouldAppendArguments = accessSHPreimage && isPublic;
    const shouldAppendThisAssignment = accessSHPreimage && accessSHPreimageInSubCall && isPublic;
    const shouldAccessThis = (!isPublic || accessSHPreimageInSubCall) && accessSHPreimage;

    return { shouldAppendArguments, shouldAppendThisAssignment, shouldAccessThis };
  }

  private transformParameter(
    node: ts.ParameterDeclaration,
    toSection: EmittedSection,
  ): EmittedSection {
    return toSection
      .appendWith(this, (toSec) => {
        if (!node.type) {
          throw new TranspileError(
            `Untransformable parameter: '${node.getText()}', all parameters should be typed explicitly`,
            this.getRange(node),
          );
        }

        return this.transformEnclosingTypeNode(node.type, toSec);
      })
      .append(' ')
      .append(node.name.getText(), this.getCoordinates(node.name.getStart()));
  }

  private transformStatement(node: ts.Statement, toSection: EmittedSection): EmittedSection {
    switch (node.kind) {
      case ts.SyntaxKind.Block: {
        return toSection
          .append('{')
          .appendWith(
            this,
            (blockSec) => {
              (node as ts.Block).statements.forEach((stmt) => {
                blockSec.append('\n').appendWith(this, (stmtsSec) => {
                  return this.transformStatement(stmt, stmtsSec);
                });
              });
              return blockSec;
            },
            true,
          )
          .append('\n}');
      }
      case ts.SyntaxKind.ExpressionStatement: {
        const s: ts.ExpressionStatement = node as ts.ExpressionStatement;

        if (
          s.expression.kind === ts.SyntaxKind.CallExpression &&
          /^super(\s*)\(.*\)/.test(s.expression.getText())
        ) {
          return toSection;
        } else if (
          s.expression.kind === ts.SyntaxKind.CallExpression &&
          /^console\./.test(s.expression.getText())
        ) {
          return toSection;
        } else if (
          s.expression.kind === ts.SyntaxKind.CallExpression &&
          /^this\.debug\./.test(s.expression.getText())
        ) {
          return toSection;
        } else if (
          s.expression.kind === ts.SyntaxKind.CallExpression &&
          /^this\.init\(/.test(s.expression.getText())
        ) {
          return toSection;
        } else if (
          s.expression.kind === ts.SyntaxKind.CallExpression &&
          /^this\.checkInputState\(/.test(s.expression.getText())
        ) {
          return this.transformCallCheckInputState(s.expression as ts.CallExpression, toSection);
        }

        return this.transformExpression(s.expression, toSection).append(';');
      }
      case ts.SyntaxKind.VariableStatement: {
        const stmt: ts.VariableStatement = node as ts.VariableStatement;
        if (stmt.declarationList.declarations.length > 1) {
          throw new TranspileError(
            `Untransformable statement: '${node.getText()}'`,
            this.getRange(node),
          );
        }

        const d = stmt.declarationList.declarations[0];
        if (!d.initializer) {
          throw new TranspileError(
            `Untransformable statement: '${node.getText()}'`,
            this.getRange(node),
          );
        }

        if (this.isCtcDeclaration(d)) {
          return toSection;
        } else {
          // use `d.type` as type context node if it exists,
          // otherwise use `d.initializer` to provide type context, so we can leverage the type inference.

          if (d.type) {
            return this.transformEnclosingTypeNode(d.type, toSection)
              .append(` ${d.name.getText()}`, this.getCoordinates(d.name.getStart()))
              .append(' = ')
              .appendWith(this, (toSec) => {
                return this.transformExpression(d.initializer!, toSec);
              })
              .append(';');
          }

          const type = this._checker.getTypeAtLocation(d.initializer);

          if (type.flags === ts.TypeFlags.String) {
            const coordinates: ts.LineAndCharacter = this.getCoordinates(d.initializer.getStart())!;
            return toSection
              .append('bytes', coordinates)
              .append(` ${d.name.getText()}`, this.getCoordinates(d.name.getStart()))
              .append(' = ')
              .appendWith(this, (toSec) => {
                return this.transformExpression(d.initializer!, toSec);
              })
              .append(';');
          }

          return this.transformEnclosingTypeNode(d.initializer, toSection)
            .append(` ${d.name.getText()}`, this.getCoordinates(d.name.getStart()))
            .append(' = ')
            .appendWith(this, (toSec) => {
              return this.transformExpression(d.initializer!, toSec);
            })
            .append(';');
        }
      }
      case ts.SyntaxKind.ReturnStatement: {
        const s: ts.ReturnStatement = node as ts.ReturnStatement;
        if (!s.expression) {
          // If only "return", then the method must be a void type.
          // The return stmt gets handled elsewhere.
          return toSection;
        }
        return toSection
          .append(`return `, this.getCoordinates(s.getStart()))
          .appendWith(this, (toSec) => {
            return this.transformExpression(s.expression!, toSec);
          })
          .append(';');
      }
      case ts.SyntaxKind.IfStatement: {
        const s: ts.IfStatement = node as ts.IfStatement;
        toSection
          .append(`if(`, this.getCoordinates(s.getStart()))
          .appendWith(this, (toSec) => {
            return this.transformExpression(s.expression, toSec);
          })
          .append(`) `)
          .appendWith(this, (toSec) => {
            return this.transformStatement(s.thenStatement, toSec);
          });

        if (s.elseStatement) {
          toSection.append(` else `).appendWith(this, (toSec) => {
            return this.transformStatement(s.elseStatement!, toSec);
          });
        }

        return toSection;
      }
      case ts.SyntaxKind.ForStatement: {
        const s = node as ts.ForStatement;

        let inductionVar: ts.BindingName | undefined = undefined;
        if (s.initializer?.kind === ts.SyntaxKind.VariableDeclarationList) {
          const ivDeclare = (s.initializer as ts.VariableDeclarationList).declarations[0];
          // initializer expr must match `let $i = 0;`
          if (
            ivDeclare.initializer!.getText() === '0' ||
            ivDeclare.initializer!.getText() === '0n'
          ) {
            inductionVar = ivDeclare.name;
          }
        }
        if (!inductionVar) {
          throw new TranspileError(
            `\`for\` statement in \`@method\` should have induction variable declaration as: 'for(let $i = 0; ...; ...)'`,
            this.getRange(s),
          );
        }

        let loopCount: undefined | string = undefined;
        if (s.condition?.kind === ts.SyntaxKind.BinaryExpression) {
          const cond = s.condition as ts.BinaryExpression;
          // condition expr must match `$i < $constNum;`
          const condVarName = cond.left.getText();
          if (condVarName === inductionVar.getText()) {
            if (cond.operatorToken.kind !== ts.SyntaxKind.LessThanToken) {
              throw new TranspileError(
                `\`for\` statement in \`@method\` should only have a \`<\`(lessthan) operator: 'for(...; $i < $constNum; ...)'`,
                this.getRange(cond.operatorToken),
              );
            }

            if (this.isCtcExpression(cond.right)) {
              if (this.isParameterNode(cond.right)) {
                loopCount = cond.right.getText();
              } else {
                loopCount = this.evalCtcExpression(cond.right);
              }
            }
          }
        }
        if (loopCount === undefined) {
          throw new TranspileError(
            `\`for\` statement in \`@method\` should have condition expression as: 'for(...; $i < $constNum; ...)'`,
            this.getRange(s),
          );
        }

        let postIncIV = false;
        // incrementor expr must match `$i++`
        if (s.incrementor?.kind === ts.SyntaxKind.PostfixUnaryExpression) {
          const inc = s.incrementor as ts.PostfixUnaryExpression;
          if (
            inc.operator === ts.SyntaxKind.PlusPlusToken &&
            inc.operand.getText() === inductionVar.getText()
          ) {
            postIncIV = true;
          }
        }
        if (!postIncIV) {
          throw new TranspileError(
            `\`for\` statement in \`@method\` should have incrementor expression as: 'for(...; ...; $i++)'`,
            this.getRange(s.incrementor!),
          );
        }

        return toSection
          .append('loop (')
          .append(loopCount)
          .append(') : ')
          .append(`${inductionVar.getText()} `, this.getCoordinates(inductionVar.getStart()))
          .appendWith(this, (toSec) => {
            return this.transformStatement(s.statement, toSec);
          });
      }
      default: {
        throw new TranspileError(
          `Untransformable statement: '${node.getText()}'`,
          this.getRange(node),
        );
      }
    }
  }

  private transformExpression(node: ts.Expression, toSection: EmittedSection): EmittedSection {
    const srcLoc = this.getCoordinates(node.getStart());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const map = new Map<ts.SyntaxKind, Function>();
    map.set(ts.SyntaxKind.NumericLiteral, (node, toSection) =>
      toSection.append(`${node.getText()}`, srcLoc),
    );
    map.set(ts.SyntaxKind.StringLiteral, (node, toSection) =>
      this.transformStringLiteralExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.BigIntLiteral, (node, toSection) =>
      this.transformBigIntLiteralExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ArrayLiteralExpression, (node, toSection) =>
      this.transformArrayLiteralExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ObjectLiteralExpression, (node, toSection) =>
      this.transformObjectLiteralExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.CallExpression, (node, toSection) =>
      this.transformCallExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.Identifier, (node, toSection) =>
      this.transformIdentifierExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.BinaryExpression, (node, toSection) =>
      this.transformBinaryExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.PropertyAccessExpression, (node, toSection) =>
      this.transformPropertyAccessExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ArrowFunction, (node, toSection) =>
      this.transformArrowFunctionExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.NewExpression, (node, toSection) =>
      this.transformNewExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ThisKeyword, (_node, toSection) => toSection.append('this', srcLoc));
    map.set(ts.SyntaxKind.TrueKeyword, (_node, toSection) => toSection.append('true', srcLoc));
    map.set(ts.SyntaxKind.FalseKeyword, (_node, toSection) => toSection.append('false', srcLoc));
    map.set(ts.SyntaxKind.SuperKeyword, (_node, toSection) => toSection);
    map.set(ts.SyntaxKind.ElementAccessExpression, (node, toSection) =>
      this.transformElementAccessExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ConditionalExpression, (node, toSection) =>
      this.transformConditionalExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.ParenthesizedExpression, (node, toSection) =>
      this.transformParenthesizedExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.PostfixUnaryExpression, (node, toSection) =>
      this.transformPostfixUnaryExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.PrefixUnaryExpression, (node, toSection) =>
      this.transformPrefixUnaryExpression(node, toSection),
    );
    map.set(ts.SyntaxKind.AsExpression, (node, toSection) =>
      toSection.appendWith(this, (toSec) => this.transformExpression(node.expression, toSec)),
    );

    const func = map.get(node.kind);
    if (func === undefined) {
      throw new TranspileError(
        `Untransformable expression kind ${ts.SyntaxKind[node.kind]}: '${node.getText()}'`,
        this.getRange(node),
      );
    }
    return func(node, toSection);
  }

  // transform the type enclosed in the node.
  private transformEnclosingTypeNode(node: ts.Node, toSection: EmittedSection): EmittedSection {
    const type = this._checker.getTypeAtLocation(node);
    return this.transformType(type, node, toSection);
  }

  private isByteStringNode(node: ts.Node): boolean {
    const type = this._checker.getTypeAtLocation(node);
    const typeString = this.type2ResolvedName(type);
    return typeString === 'ByteString' || typeString === 'OpCodeType';
  }

  // `typeStrCtx` is the type's literal name or the text of the node which encloses the type.
  private transformType(type: ts.Type, node: ts.Node, toSection: EmittedSection): EmittedSection {
    const typeStrCtx = node.getText();
    const coordinates: ts.LineAndCharacter = this.getCoordinates(node.getStart())!;
    switch (type.flags) {
      case ts.TypeFlags.Union + ts.TypeFlags.Boolean: // This is the real internal type of `boolean`, it's a union of `true` and `false`
      case ts.TypeFlags.BooleanLiteral:
      case ts.TypeFlags.Boolean: {
        return toSection.append('bool', coordinates);
      }
      case ts.TypeFlags.Union + ts.TypeFlags.EnumLiteral:
      case ts.TypeFlags.BigIntLiteral:
      case ts.TypeFlags.BigInt: {
        return toSection.append('int', coordinates);
      }
      case ts.TypeFlags.NumberLiteral:
      case ts.TypeFlags.Number: {
        if (ts.isParameter(node.parent)) {
          return toSection.append('static const int', coordinates);
        }

        throw new TranspileError(
          `Untransformable type \`number\` here, please use type \`bigint\` instead`,
          this.getRange(node),
        );
      }
      case ts.TypeFlags.Intersection:
      case ts.TypeFlags.Object: {
        const typeString = this.type2ResolvedName(type);

        // for declared object literal type, like `x : {prop: number}`
        if (typeString === '__type') {
          throw new TranspileError(
            `Untransformable literal object type: '${typeStrCtx}'`,
            this.getRange(node),
          );
        }

        // for inferred object literal type, like `x = {prop: 1}`
        if (typeString === '__object') {
          throw new TranspileError(
            `Untransformable literal object type: '${typeStrCtx}'`,
            this.getRange(node),
          );
        }

        // for bigint & number wrapper
        if (typeString === 'BigInt') {
          return toSection.append('int', coordinates);
        }

        if (typeString === 'Number') {
          throw new TranspileError(
            `Untransformable type \`${typeStrCtx}\` here, please use type \`bigint\` instead`,
            this.getRange(node),
          );
        }

        // for string wrapper
        if (typeString === 'String') {
          throw new TranspileError(
            `Untransformable type \`${typeStrCtx}\` here, please use type \`ByteString\` instead`,
            this.getRange(node),
          );
        }

        const isFixedArray = (type: ts.Type) => {
          if (type.isUnionOrIntersection() && type.types.length === 2) {
            const t1 = this._checker.typeToString(type.types[0]);

            const t2 = this._checker.typeToString(type.types[1]);

            if (t1.endsWith('[]') && /\{\slength:\s((\d+)|(number)|(any));\s\}/.test(t2)) {
              return true;
            }
          }

          return false;
        };

        if (isFixedArray(type)) {
          const getBaseElemTypeAndLengths = (
            typeRef: ts.TypeReference,
            arrLens: Array<number | string>,
          ) => {
            if (typeRef.isUnionOrIntersection() && isFixedArray(typeRef)) {
              const FixedArrayLenString = this._checker.typeToString(typeRef.types[1]);

              const m = /(\d)+/.exec(FixedArrayLenString);

              if (m) {
                const fst = this._checker.getTypeArguments(typeRef.types[0] as ts.TypeReference);
                return getBaseElemTypeAndLengths(
                  fst[0] as ts.TypeReference,
                  arrLens.concat(parseInt(m[0])),
                );
              } else {
                throw new TranspileError(
                  `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                  this.getRange(node),
                );
              }
            } else {
              return { typeRef: typeRef, arrLens };
            }
          };

          const getBaseElemTypeAndLengthsIncludeCTC = (
            tNode: ts.Node,
            arrLens: Array<number | string>,
          ): {
            typeRef: ts.Type;
            arrLens: Array<number | string>;
          } => {
            const typeRef = this._checker.getTypeAtLocation(tNode);

            if (typeRef.isUnionOrIntersection() && isFixedArray(typeRef)) {
              const FixedArrayLenString = this._checker.typeToString(typeRef.types[1]);

              if (ts.isTypeReferenceNode(tNode)) {
                if (
                  FixedArrayLenString === '{ length: number; }' &&
                  tNode.typeArguments &&
                  tNode.typeArguments.length == 2 &&
                  ts.isTypeQueryNode(tNode.typeArguments[1])
                ) {
                  if (this.isParameterNode(tNode.typeArguments[1].exprName)) {
                    return getBaseElemTypeAndLengthsIncludeCTC(
                      tNode.typeArguments[0],
                      arrLens.concat(tNode.typeArguments[1].exprName.getText()),
                    );
                  } else {
                    throw new TranspileError(
                      `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                      this.getRange(node),
                    );
                  }
                } else if (
                  FixedArrayLenString === '{ length: any; }' &&
                  tNode.typeArguments &&
                  tNode.typeArguments.length == 2 &&
                  ts.isUnionTypeNode(tNode.typeArguments[1]) &&
                  ts.isTypeQueryNode(tNode.typeArguments[1].types[0])
                ) {
                  if (this.isParameterNode(tNode.typeArguments[1].types[0].exprName)) {
                    return getBaseElemTypeAndLengthsIncludeCTC(
                      tNode.typeArguments[0],
                      arrLens.concat(tNode.typeArguments[1].types[0].exprName.getText()),
                    );
                  } else {
                    throw new TranspileError(
                      `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                      this.getRange(node),
                    );
                  }
                } else {
                  const m = /(\d)+/.exec(FixedArrayLenString);

                  if (m) {
                    if (tNode.typeArguments && tNode.typeArguments[0]) {
                      return getBaseElemTypeAndLengthsIncludeCTC(
                        tNode.typeArguments[0],
                        arrLens.concat(parseInt(m[0])),
                      );
                    } else {
                      const fst = this._checker.getTypeArguments(
                        typeRef.types[0] as ts.TypeReference,
                      );
                      return getBaseElemTypeAndLengths(
                        fst[0] as ts.TypeReference,
                        arrLens.concat(parseInt(m[0])),
                      );
                    }
                  } else {
                    throw new TranspileError(
                      `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                      this.getRange(node),
                    );
                  }
                }
              } else {
                const m = /(\d)+/.exec(FixedArrayLenString);

                if (m) {
                  const fst = this._checker.getTypeArguments(typeRef.types[0] as ts.TypeReference);
                  return getBaseElemTypeAndLengths(
                    fst[0] as ts.TypeReference,
                    arrLens.concat(parseInt(m[0])),
                  );
                } else {
                  throw new TranspileError(
                    `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                    this.getRange(node),
                  );
                }
              }
            } else {
              return { typeRef: typeRef, arrLens };
            }
          };

          const { typeRef: baseElemType, arrLens } = getBaseElemTypeAndLengthsIncludeCTC(node, []);

          this.transformType(baseElemType, node, toSection).append(
            `${arrLens.map((i) => '[' + i + ']').join('')}`,
            coordinates,
          );
        } else if (typeString === 'Array' || typeString === '[]') {
          const isOldFixedArray = (typeRef: ts.TypeReference) => {
            if (typeRef.typeArguments!.length > 0) {
              const typeString = this.type2ResolvedName(typeRef.typeArguments![0]);
              return typeString.includes('Flavor') && typeString.includes('FixedArray');
            } else {
              return false;
            }
          };

          if (isOldFixedArray(type as ts.TypeReference)) {
            const getBaseElemTypeAndLengths = (typeRef: ts.TypeReference, arrLens: number[]) => {
              if (typeRef.typeArguments!.length > 0) {
                const innerTypeRef = typeRef.typeArguments![0];

                if (innerTypeRef.aliasTypeArguments!.length > 1) {
                  const FixedArrayString = this.type2ResolvedName(
                    innerTypeRef.aliasTypeArguments![1],
                  );

                  const m = /(\d)+/.exec(FixedArrayString);

                  if (m) {
                    return getBaseElemTypeAndLengths(
                      innerTypeRef.aliasTypeArguments![0] as ts.TypeReference,
                      arrLens.concat(parseInt(m[0])),
                    );
                  }

                  throw new TranspileError(
                    `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
                    this.getRange(node),
                  );
                } else {
                  return getBaseElemTypeAndLengths(
                    innerTypeRef as ts.TypeReference,
                    arrLens.concat(typeRef.typeArguments!.length),
                  );
                }
              } else {
                return { typeRef, arrLens };
              }
            };

            const { typeRef: baseElemType, arrLens } = getBaseElemTypeAndLengths(
              type as ts.TypeReference,
              [],
            );

            this.transformType(baseElemType, node, toSection).append(
              `${arrLens.map((i) => '[' + i + ']').join('')}`,
              coordinates,
            );
            return toSection;
          } else {
            throw new TranspileError(
              `Untransformable type \`Array\`, please use type \`FixedArray\` instead`,
              this.getRange(node),
            );
          }
        } else if (typeString.startsWith('[') && typeString.endsWith(']')) {
          // built-in type `FixedArray` goes here.
          const getBaseElemTypeAndLengths = (typeRef: ts.TypeReference, arrLens: number[]) => {
            if (typeRef.typeArguments!.length > 0) {
              const innerTypeRef = typeRef.typeArguments![0];
              return getBaseElemTypeAndLengths(
                innerTypeRef as ts.TypeReference,
                arrLens.concat(typeRef.typeArguments!.length),
              );
            } else {
              return { typeRef, arrLens };
            }
          };

          const { typeRef: baseElemType, arrLens } = getBaseElemTypeAndLengths(
            type as ts.TypeReference,
            [],
          );

          this.transformType(baseElemType, node, toSection).append(
            `${arrLens.map((i) => '[' + i + ']').join('')}`,
            coordinates,
          );
        } else {
          const t = toBuiltinsTypes(typeString);

          if (t) {
            toSection.append(t, coordinates);
          } else {
            // all user defined or std types go here.
            toSection.append(typeString, coordinates);

            if (type.symbol) {
              this.saveSymbol(typeString, type.symbol);
            }
          }
        }

        break;
      }
      case ts.TypeFlags.Any: {
        toSection.append('auto', coordinates);
        break;
      }
      case ts.TypeFlags.String: {
        throw new TranspileError(
          `Untransformable type \`${typeStrCtx}\` here, please use type \`ByteString\` instead`,
          this.getRange(node),
        );
      }
      default: {
        if (ts.isTypeReferenceNode(node)) {
          // for boolean wrapper
          if (this.type2ResolvedName(type) === 'Bool') {
            return toSection.append('bool', coordinates);
          }
          throw new TranspileError(`Untransformable type : '${typeStrCtx}'`, this.getRange(node));
        } else {
          throw new TranspileError(
            `Untransformable type : '${typeStrCtx}', missing explicitly declared type`,
            this.getRange(node),
          );
        }
      }
    }
    return toSection;
  }

  private saveSymbol(symbolName: string, symbol: ts.Symbol) {
    // skip importing or local declaration for these keyword symbols.
    if (['SmartContract', 'OpCode'].includes(symbolName)) {
      return;
    }

    const symbolSourceFile = this.findDeclarationFile(symbol);
    if (symbolSourceFile === this._srcFile) {
      this._localTypeSymbols.set(symbolName, symbol);
    } else {
      this._importedTypeSymbols.set(symbolName, symbol);
    }
  }

  private transformModifiers(node: ts.HasModifiers, toSection: EmittedSection): EmittedSection {
    const modifiers = ts.getModifiers(node);
    if (modifiers) {
      modifiers.forEach((modifier) => {
        switch (modifier.kind) {
          case ts.SyntaxKind.PublicKeyword: {
            toSection.append('public ', this.getCoordinates(modifier.getStart()));
            break;
          }
          case ts.SyntaxKind.PrivateKeyword: {
            toSection.append('private ', this.getCoordinates(modifier.getStart()));
            break;
          }
          case ts.SyntaxKind.ProtectedKeyword: {
            // transform to nothing in scrypt
            break;
          }
          case ts.SyntaxKind.StaticKeyword: {
            toSection.append('static ', this.getCoordinates(modifier.getStart()));
            break;
          }
          case ts.SyntaxKind.ReadonlyKeyword: {
            toSection.append('const ', this.getCoordinates(modifier.getStart()));
            break;
          }
          default: {
            throw new TranspileError(
              `Untransformable modifier kind ${modifier.kind}: '${modifier.getText()}'`,
              this.getRange(modifier),
            );
          }
        }
      });
    }
    return toSection;
  }

  private static findDecorator(node: ts.Node, decorator: DecoratorName): ts.Decorator | undefined {
    if (ts.canHaveDecorators(node)) {
      return (ts.getDecorators(node) || []).find((dec) => {
        return dec.expression.getText().match(new RegExp(`^${decorator}\\((.*)?\\)$`));
      });
    }
    return undefined;
  }

  private static isProperty(node: ts.Node): boolean {
    if (ts.isPropertyDeclaration(node)) {
      const decorator = Transpiler.findDecorator(node, DecoratorName.Prop);

      if (decorator) {
        return true;
      }
    }

    return false;
  }

  private static isMethod(node: ts.Node): boolean {
    if (ts.isMethodDeclaration(node)) {
      const decorator = Transpiler.findDecorator(node, DecoratorName.Method);

      if (decorator) {
        return true;
      }
    }

    return false;
  }

  private isNonProp(node: ts.Node): boolean {
    if (ts.isPropertyDeclaration(node)) {
      const decorator = Transpiler.findDecorator(node, DecoratorName.Prop);

      if (!decorator) {
        return true;
      }
    }

    return false;
  }

  private isStaticReadOnlyNonProp(node: ts.Node): boolean {
    if (ts.isPropertyDeclaration(node)) {
      const decorator = Transpiler.findDecorator(node, DecoratorName.Prop);
      return (
        !decorator &&
        hasModifier(node, ts.SyntaxKind.StaticKeyword) &&
        hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)
      );
    }

    return false;
  }

  private static isStateProperty(node: ts.Node): boolean {
    if (ts.isPropertyDeclaration(node)) {
      const decorator = Transpiler.findDecorator(node, DecoratorName.Prop);

      if (decorator) {
        return /^prop\((true)+\)$/.test(decorator.expression.getText());
      }
    }

    return false;
  }

  private static getClassDeclaration(node: ts.Node): ts.ClassDeclaration | undefined {
    if (!node.parent) {
      return undefined;
    }

    if (ts.isClassDeclaration(node.parent)) {
      return node.parent;
    }

    return Transpiler.getClassDeclaration(node.parent);
  }

  private static getMethodDeclaration(node: ts.Node): ts.MethodDeclaration | undefined {
    if (!node.parent) {
      return undefined;
    }

    if (ts.isMethodDeclaration(node.parent)) {
      return node.parent;
    }

    return Transpiler.getMethodDeclaration(node.parent);
  }

  private static getIfStatement(node: ts.Node): ts.IfStatement | undefined {
    if (!node.parent) {
      return undefined;
    }

    if (ts.isIfStatement(node.parent)) {
      return node.parent;
    }

    return Transpiler.getIfStatement(node.parent);
  }

  private findMethodDeclaration(name: string): ts.MethodDeclaration | undefined {
    const m = this._currentContract.members.find((m) => {
      return Transpiler.isMethod(m) && m.name!.getText() === name;
    }) as ts.MethodDeclaration | undefined;

    if (m) {
      return m;
    }

    if (this.currentbaseContract) {
      return this.currentbaseContract.members.find((m) => {
        return Transpiler.isMethod(m) && m.name!.getText() === name;
      }) as ts.MethodDeclaration | undefined;
    }

    return undefined;
  }

  private isNonPropReferences(node: ts.ClassDeclaration, name: string): boolean {
    return node.members
      .filter((member) => this.isNonProp(member))
      .map((m) => {
        const p = m as ts.PropertyDeclaration;
        return p.name.getText();
      })
      .includes(name);
  }

  private allPropertyDeclaration(node: ts.Node): ts.PropertyDeclaration[] {
    if (ts.isClassDeclaration(node)) {
      return node.members.filter((member) =>
        Transpiler.isProperty(member),
      ) as ts.PropertyDeclaration[];
    }
    return [];
  }

  private isCtcBinaryExpression(node: ts.BinaryExpression): boolean {
    const operators = [
      ts.SyntaxKind.PlusToken,
      ts.SyntaxKind.MinusToken,
      ts.SyntaxKind.AsteriskToken,
    ];
    return (
      operators.indexOf(node.operatorToken.kind) !== -1 &&
      this.isCtcExpression(node.left) &&
      this.isCtcExpression(node.right)
    );
  }

  private isCtcPrefixUnaryExpression(node: ts.PrefixUnaryExpression): boolean {
    const operators = [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken];
    return operators.indexOf(node.operator) !== -1 && this.isCtcExpression(node.operand);
  }

  private isCtcParenthesizedExpression(node: ts.ParenthesizedExpression): boolean {
    return this.isCtcExpression(node.expression);
  }

  private isCtcExpression(node: ts.Node): boolean {
    if (!node || !ts.isExpression(node)) {
      return false;
    }
    if (isNumberLiteralExpr(node)) {
      return true;
    }
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
      return this.isCtcIdentifierOrProperty(node);
    }
    if (ts.isBinaryExpression(node)) {
      return this.isCtcBinaryExpression(node);
    }
    if (ts.isPrefixUnaryExpression(node)) {
      return this.isCtcPrefixUnaryExpression(node);
    }
    if (ts.isParenthesizedExpression(node)) {
      return this.isCtcParenthesizedExpression(node);
    }
    return false;
  }

  private isCtcDeclaration(node: ts.Node): boolean {
    if (ts.isPropertyDeclaration(node) && node['initializer']) {
      if (
        hasModifier(node, ts.SyntaxKind.StaticKeyword) &&
        hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)
      ) {
        return this.isCtcExpression(node['initializer']);
      } else if (hasModifier(node, ts.SyntaxKind.ConstKeyword)) {
        return this.isCtcExpression(node['initializer']);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      node['initializer'] &&
      ts.getCombinedNodeFlags(node) === ts.NodeFlags.Const
    ) {
      return this.isCtcExpression(node['initializer']);
    } else if (ts.isParameter(node) && node.type) {
      return node.type?.kind === ts.SyntaxKind.NumberKeyword;
    }
    return false;
  }

  private isCtcIdentifierOrProperty(node: ts.Node): boolean {
    const symbol = this._checker.getSymbolAtLocation(node);
    if (symbol) {
      if (symbol.valueDeclaration) {
        // local ctc
        return this.isCtcDeclaration(symbol.valueDeclaration);
      }

      // imported ctc
      return this.getImportedCtcValue(symbol) !== undefined;
    }
    return false;
  }

  private isParameterNode(node: ts.Node): boolean {
    const symbol = this._checker.getSymbolAtLocation(node);
    if (!symbol || !symbol.valueDeclaration) {
      return false;
    }
    return ts.isParameter(symbol.valueDeclaration);
  }

  private evalCtcBinaryExpression(node: ts.BinaryExpression): string {
    const left = this.evalCtcExpression(node.left);
    const right = this.evalCtcExpression(node.right);
    const operator = node.operatorToken.getText();
    return eval(`BigInt("${left}") ${operator} BigInt("${right}")`).toString().replace('n', '');
  }

  private evalCtcPrefixUnaryExpression(node: ts.PrefixUnaryExpression): string {
    const operand = this.evalCtcExpression(node.operand);
    const operator = node.operator === ts.SyntaxKind.MinusToken ? '-' : '';
    return eval(`${operator}BigInt("${operand}")`).toString().replace('n', '');
  }

  private evalCtcParenthesizedExpression(node: ts.ParenthesizedExpression): string {
    return this.evalCtcExpression(node.expression);
  }

  private evalCtcExpression(node: ts.Node): string {
    if (isNumberLiteralExpr(node)) {
      return eval(node.getText()).toString().replace('n', '');
    }
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
      const symbol = this._checker.getSymbolAtLocation(node)!;
      if (symbol.valueDeclaration) {
        return this.evalCtcExpression(symbol.valueDeclaration['initializer']);
      }

      const ctcValue = this.getImportedCtcValue(symbol);
      if (ctcValue) {
        return ctcValue;
      }
    }
    if (ts.isBinaryExpression(node)) {
      return this.evalCtcBinaryExpression(node);
    }
    if (ts.isPrefixUnaryExpression(node)) {
      return this.evalCtcPrefixUnaryExpression(node);
    }
    if (ts.isParenthesizedExpression(node)) {
      return this.evalCtcParenthesizedExpression(node);
    }
    throw new TranspileError(
      `Cannot eval a non-CTC expression: '${node.getText()}'`,
      this.getRange(node),
    );
  }

  private getImportedCtcValue(symbol: ts.Symbol): string | undefined {
    if (symbol.declarations) {
      const symbolDecl = (symbol.declarations ?? [])[0];
      if (symbolDecl && ts.isImportSpecifier(symbolDecl)) {
        const importDecl = symbolDecl.parent.parent.parent;
        if (ts.isImportDeclaration(importDecl)) {
          const moduleSpecifier = symbolDecl.parent.parent.parent.moduleSpecifier
            .getText()
            .replace(/['"]/g, '');
          const resolvedMoudle = ts.resolveModuleName(
            moduleSpecifier,
            this._srcFile.fileName,
            this._compilerOptions,
            this._host!,
          );
          const ctcExportFile = resolvedMoudle.resolvedModule?.resolvedFileName;
          if (ctcExportFile) {
            const nodeType = this._checker.getTypeAtLocation(symbolDecl);
            if (nodeType.isNumberLiteral()) {
              return nodeType.value.toString().replace('n', '');
            }

            // for bigint literal
            if (nodeType.isLiteral() && (nodeType.value as ts.PseudoBigInt).base10Value) {
              const negative = (nodeType.value as ts.PseudoBigInt).negative ? '-' : '';
              return (
                negative +
                (nodeType.value as ts.PseudoBigInt).base10Value.toString().replace('n', '')
              );
            }

            return Transpiler.topCtcs.get(
              `${sha1(ctcExportFile)}:${symbolDecl.propertyName?.getText() || symbolDecl.name.getText()
              }`,
            );
          }
        }
      }
    }
    return undefined;
  }

  private transformCtcExpr(expr: ts.Node, toSection: EmittedSection): EmittedSection {
    const coordinates: ts.LineAndCharacter = this.getCoordinates(expr.getStart())!;
    const ctcValue = this.evalCtcExpression(expr).toString().replace('n', '');
    toSection.append(ctcValue, coordinates);
    return toSection;
  }

  private transformCtcNode(node: ts.Node, toSection: EmittedSection): EmittedSection {
    if (this.isParameterNode(node)) {
      // ctc parameter
      const coordinates: ts.LineAndCharacter = this.getCoordinates(node.getStart())!;
      toSection.append(node.getText(), coordinates);
      return toSection;
    }

    const symbol = this._checker.getSymbolAtLocation(node);

    if (symbol && symbol.valueDeclaration) {
      // local ctc
      return this.transformCtcExpr(symbol.valueDeclaration['initializer'], toSection);
    }

    if (symbol) {
      const ctcValue = this.getImportedCtcValue(symbol);
      if (ctcValue) {
        // imported ctc
        return toSection.append(ctcValue, this.getCoordinates(node.getStart()));
      }
    }

    throw new TranspileError(`Cannot find ctc value: '${node.getText()}'`, this.getRange(node));
  }

  private queryPropertyInitializedInStmt(node: ts.Statement): ts.PropertyDeclaration | undefined {
    if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)) {
      if (
        node.expression.operatorToken.getText() === '=' &&
        ts.isPropertyAccessExpression(node.expression.left) &&
        node.expression.left.expression.getText() === 'this'
      ) {
        const symbol = this._checker.getSymbolAtLocation(node.expression.left.name);

        if (
          symbol &&
          symbol.valueDeclaration &&
          ts.isPropertyDeclaration(symbol.valueDeclaration)
        ) {
          return symbol.valueDeclaration;
        }
      }
    }

    return undefined;
  }

  private hasProperties(node: ts.ClassDeclaration): boolean {
    return (
      node.members.findIndex(
        (m) =>
          ts.isPropertyDeclaration(m) &&
          typeof Transpiler.findDecorator(m, DecoratorName.Prop) !== 'undefined',
      ) > -1
    );
  }

  private static isStaticProperty(node: ts.Node) {
    if (Transpiler.isProperty(node)) {
      return hasModifier(node, ts.SyntaxKind.StaticKeyword);
    }

    return false;
  }

  private static isReadonlyProperty(node: ts.Node) {
    if (Transpiler.isProperty(node)) {
      return hasModifier(node, ts.SyntaxKind.ReadonlyKeyword);
    }

    return false;
  }

  private onlyHasStaticProperties(node: ts.ClassDeclaration): boolean {
    return node.members
      .filter((m) => ts.isPropertyDeclaration(m))
      .every((m) => {
        return (
          Transpiler.findDecorator(m, DecoratorName.Prop) === undefined ||
          Transpiler.isStaticProperty(m)
        );
      });
  }

  private hasConstructor(node: ts.ClassDeclaration): boolean {
    return node.members.findIndex((m) => ts.isConstructorDeclaration(m)) > -1;
  }

  private getConstructor(node: ts.ClassDeclaration): ts.ConstructorDeclaration {
    return node.members.find((m) => ts.isConstructorDeclaration(m)) as ts.ConstructorDeclaration;
  }

  private checkConstructor(node: ts.ClassDeclaration): void {
    if (this.hasProperties(node)) {
      if (this.onlyHasStaticProperties(node)) {
        return;
      }

      if (!this.hasConstructor(node)) {
        throw new TranspileError(
          `Untransformable contract: a smart contract must have an explicit constructor if it has at least one @prop.`,
          this.getRange(node),
        );
      }

      if (this.isInherited(node)) {
        this.checkSetConstructorStmt(this.getConstructor(node));
      } else {
        this.checkSuperStmt(this.getConstructor(node));
      }
    }
  }

  private getImportedPath(fulSymbolPath: string) {
    const filePath = path.relative(path.dirname(this._scryptFullPath), fulSymbolPath);
    if (!filePath.startsWith('.')) {
      return `./${filePath}`;
    }
    return filePath;
  }

  private resolvePackageDir(symbolFileFullPath: string): string | undefined {
    let searchDir = path.dirname(symbolFileFullPath);
    do {
      const locatePath = path.join(searchDir, 'package.json');
      if (existsSync(locatePath)) {
        return path.dirname(locatePath);
      }

      if (path.join(searchDir, '..') === searchDir) {
        return undefined;
      }

      searchDir = path.join(searchDir, '..');

      // eslint-disable-next-line no-constant-condition
    } while (true);
  }

  private getThirdPartyPackageName(packageDir: string): string {
    const packageJson = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    return packageJson.name;
  }

  private saveThirdPartySymbol(symbol: ts.Symbol, symbolName: Symbol, fullSymbolPath: string) {
    const symbolFile = this.findDeclarationFile(symbol);
    if (!symbolFile) return;
    const symbolFileFullPath = symbolFile.fileName;

    const symbolPath = this.getRelativePathFromArtifacts(fullSymbolPath);
    let symbolDec = symbol.declarations![0];
    symbolDec = symbolDec['name'] || symbolDec;

    this._indexer.addSymbols(
      [
        {
          name: symbolName,
          srcRange: {
            fileName: symbolFileFullPath,
            start: symbolFile.getLineAndCharacterOfPosition(symbolDec.getStart()),
            end: symbolFile.getLineAndCharacterOfPosition(symbolDec.getEnd()),
          },
        },
      ],
      symbolPath,
    );
  }

  private saveLocalSymbol(symbol: ts.Symbol, symbolName: Symbol, fullSymbolPath: string) {
    const symbolFile = this.findDeclarationFile(symbol);
    if (!symbolFile) return;
    const symbolFileFullPath = symbolFile.fileName;

    const symbolPath = this.getRelativePathFromTsRoot(fullSymbolPath);
    let symbolDec = symbol.declarations![0];
    symbolDec = symbolDec['name'] || symbolDec;

    this._indexer.addSymbols(
      [
        {
          name: symbolName,
          srcRange: {
            fileName: symbolFileFullPath,
            start: symbolFile.getLineAndCharacterOfPosition(symbolDec.getStart()),
            end: symbolFile.getLineAndCharacterOfPosition(symbolDec.getEnd()),
          },
        },
      ],
      symbolPath,
    );
  }

  private transformImports(
    allmissSym: Map<ts.SourceFile, Map<string, ts.Symbol>>,
    relinker: Relinker,
  ): EmittedSection {
    const importsSection = new EmittedSection();
    const imports = new Set<string>();
    const missSymbols = new Map<ts.SourceFile, Map<string, ts.Symbol>>();
    const fromPkgName = Relinker.getFilePackageInfo(this._scryptFullPath).packageName;

    Array.from(this._importedTypeSymbols.entries()).forEach((entry) => {
      const symbolName = entry[0];
      const symbol = entry[1];
      const symbolFile = this.findDeclarationFile(symbol);
      if (!symbolFile) return;
      const symbolFileFullPath = symbolFile.fileName;

      if (this.isFromThirdParty(symbolFileFullPath)) {
        const thirdPartyBaseDir = this.resolvePackageDir(symbolFileFullPath);

        if (!thirdPartyBaseDir) {
          importsSection.errors.push(
            new TranspileError(`Invalid symbol '${symbolName}', missing \`package.json\``, {
              fileName: symbolFileFullPath,
              start: { line: -1, character: -1 },
              end: { line: -1, character: -1 },
            }),
          );
          return;
        }

        const thirdPartyIndexFile = Indexer.queryIndexFile(
          path.dirname(symbolFileFullPath),
          thirdPartyBaseDir,
        );
        if (!thirdPartyIndexFile) {
          if (symbol.flags !== ts.SymbolFlags.TypeLiteral) {
            const message =
              symbolName === 'IContext'
                ? '`IContext` is not allowed to be defined in the contract'
                : `Invalid symbol '${symbolName}', missing \`scrypt.index.json\` in the third party root directory ${thirdPartyBaseDir}`;
            importsSection.errors.push(
              new TranspileError(message, {
                fileName: symbolFileFullPath,
                start: { line: -1, character: -1 },
                end: { line: -1, character: -1 },
              }),
            );
            return;
          } else {
            // case: builtin types from scrypt-ts-btc which does not have an index file
            // const symbols = missSymbols.get(symbolFile) || new Map<string, ts.Symbol>();
            // symbols.set(symbolName, symbol);
            // missSymbols.set(symbolFile, symbols);
          }
        } else {
          const thirdPartyIndexer = new Indexer(thirdPartyIndexFile);
          const thirdPartyFullPath = thirdPartyIndexer.getFullPath(symbolName as Symbol);
          if (!thirdPartyFullPath) {
            importsSection.errors.push(
              new TranspileError(
                symbolName === 'IContext'
                  ? '`IContext` is not allowed to be defined in the contract'
                  : `Invalid symbol '${symbolName}', missing index info of symbol ${symbolName} in the third party indexer file '${thirdPartyIndexFile}'`,
                {
                  fileName: symbolFileFullPath,
                  start: { line: -1, character: -1 },
                  end: { line: -1, character: -1 },
                },
              ),
            );

            return;
          } else {
            this.saveThirdPartySymbol(symbol, symbolName as Symbol, thirdPartyFullPath);
            imports.add(
              thirdPartyIndexer.getPackageFilePath(
                this.getThirdPartyPackageName(thirdPartyBaseDir),
                symbolName as Symbol,
              ),
            );
          }
        }
      } else {
        // local imports
        let symbolPath = this._indexer.getFullPath(symbolName as Symbol)!;
        if (symbolPath && existsSync(symbolPath)) {
          imports.add(this.getImportedPath(symbolPath));
        } else {
          this.saveLocalSymbol(symbol, symbolName as Symbol, symbolFileFullPath);
          symbolPath = this._indexer.getFullPath(symbolName as Symbol)!;
          imports.add(this.getImportedPath(symbolPath));

          const symbols = missSymbols.get(symbolFile) || new Map<string, ts.Symbol>();
          symbols.set(symbolName, symbol);
          missSymbols.set(symbolFile, symbols);
        }
      }
    });

    // merge all miss import local symbols
    if (missSymbols.size > 0) {
      missSymbols.forEach((value, key) => {
        if (allmissSym.has(key)) {
          const map = allmissSym.get(key)!;
          value.forEach((v, k) => {
            map.set(k, v);
          });
        } else {
          allmissSym.set(key, value);
        }
      });

      // generate scrypt file for missing Imported local symbol
      allmissSym.forEach((symbols: Map<string, ts.Symbol>, symbolFile: ts.SourceFile) => {
        const transpiler = new Transpiler(
          symbolFile,
          this._host,
          this._checker,
          this._tsRootDir,
          this._scryptOutDir,
          this._indexer,
          this._compilerOptions,
        );

        transpiler.setLocalSymbols(symbols);
        transpiler.transform(allmissSym, relinker);
        // imports.add(transpiler._scryptRelativePath);
      });
    }

    // only import builtins for non-builtin packages
    if (fromPkgName !== BUILDIN_PACKAGE_NAME) {
      this.importAllBuiltins(imports);
    }

    imports.forEach((import_) => {
      importsSection
        .append('import ')
        .append(`"${import_.replaceAll('\\', '/')}"`)
        .append(';')
        .append('\n');
    });

    return importsSection;
  }

  private loadBuiltinIndexer() {
    const scryptTsBtcDir = findPackageDir(BUILDIN_PACKAGE_NAME, process.cwd());
    const builtinIndexerFile = Indexer.queryIndexFile(
      scryptTsBtcDir,
      path.join(scryptTsBtcDir, '..'),
    );
    if (!builtinIndexerFile) {
      throw new Error(
        `Missing \`scrypt.index.json\` for the built-in types & libraries in the directory \`${scryptTsBtcDir}\``,
      );
    }
    this._builtinIndexer = new Indexer(builtinIndexerFile);
  }

  private importAllBuiltins(imports: Set<string>) {
    if (!this._currentContract) {
      // skip import builtins for non-contract file
      return;
    }

    const scryptTsBtcDir = findPackageDir(BUILDIN_PACKAGE_NAME, process.cwd());
    const pkgName = this.getThirdPartyPackageName(scryptTsBtcDir);
    new Set(this._builtinIndexer.symbolInfos.keys()).forEach((symbolName) => {
      if (this._accessBuiltinsSymbols.has(symbolName)) {
        const builtinFullPath = this._builtinIndexer.getPackageFilePath(
          pkgName,
          symbolName as Symbol,
        );
        imports.add(builtinFullPath);
      }
    });
  }

  private transformTypeLiteralAndInterfaces(): EmittedSection {
    const structSecs: EmittedSection[] = [];
    const enumSecs: EmittedSection[] = [];
    this._localTypeSymbols.forEach((symbol, symbolTypeName) => {
      const symbolDec = symbol.declarations![0];
      if (
        [
          ts.SyntaxKind.TypeLiteral,
          ts.SyntaxKind.InterfaceDeclaration,
          ts.SyntaxKind.TypeAliasDeclaration,
        ].includes(symbolDec.kind)
      ) {
        const stSec = new EmittedSection().appendWith(this, (stSec) => {
          return stSec
            .append('\nstruct ')
            .append(`${symbolTypeName} {`, this.getCoordinates(symbolDec.getStart()))
            .appendWith(
              this,
              (fieldsSec) => {
                let members;
                if (ts.SyntaxKind.TypeAliasDeclaration === symbolDec.kind) {
                  // TODO: resolve recursive type alias
                  const symbol = this._checker.getTypeAtLocation(
                    (symbolDec as ts.TypeAliasDeclaration).type,
                  ).symbol;
                  members = symbol.members!;
                } else {
                  members = symbol.members!;
                }

                members.forEach((memSymbol) => {
                  fieldsSec.append('\n').appendWith(this, (fieldSec) => {
                    return this.transformPropertySignature(
                      memSymbol.valueDeclaration as ts.PropertySignature,
                      fieldSec,
                    );
                  });
                });
                return fieldsSec;
              },
              true,
            )
            .append('\n}');
        });

        structSecs.push(stSec);
      } else if (ts.isEnumDeclaration(symbolDec)) {
        const enumDeclaration: ts.EnumDeclaration = symbolDec;
        const enumSec = new EmittedSection().appendWith(this, (enumSec) => {
          return enumSec
            .append('\nlibrary ')
            .append(`${symbolTypeName} {`, this.getCoordinates(symbolDec.getStart()))
            .appendWith(
              this,
              (enumMembersSec) => {
                let prevEnumMemValue = -1;
                enumDeclaration.members.forEach((enumMember) => {
                  enumMembersSec
                    .append('\n')
                    .append(`static const int ${enumMember.name.getText()} = `)
                    .appendWith(this, (enumMemberSec) => {
                      if (enumMember.initializer) {
                        const type = this._checker.getTypeAtLocation(enumMember.initializer);

                        if (type.flags !== ts.TypeFlags.NumberLiteral) {
                          throw new TranspileError(
                            `Untransformable enum member: '${symbolTypeName}.${enumMember.name.getText()}', only allowed number literal in enum`,
                            this.getRange(enumMember),
                          );
                        }

                        prevEnumMemValue = parseInt(enumMember.initializer.getText());

                        return this.transformExpression(enumMember.initializer, enumMemberSec);
                      } else {
                        prevEnumMemValue++;
                        enumMemberSec.append(`${prevEnumMemValue}`);
                      }

                      return enumMemberSec;
                    })
                    .append(';');
                });
                return enumMembersSec;
              },
              true,
            )
            .append('\n}');
        });

        enumSecs.push(enumSec);
      }
    });
    return EmittedSection.join(...structSecs.concat(enumSecs));
  }

  private toScryptBinary(node: ts.Node, operator: string): string {
    switch (operator) {
      case '==':
      case '!=':
      case '+':
      case '-':
      case '+=':
      case '-=':
      case '<':
      case '>':
      case '<=':
      case '>=':
      case '&&':
      case '||':
      case '*':
      case '/':
      case '%':
      case '=':
        return operator;
      case '===':
        return '==';
      case '!==':
        return '!=';
      default:
        throw new TranspileError(
          `Untransformable binary operator: '${operator}'`,
          this.getRange(node),
        );
    }
  }

  // SyntaxKind.PlusPlusToken | SyntaxKind.MinusMinusToken | SyntaxKind.PlusToken | SyntaxKind.MinusToken | SyntaxKind.TildeToken | SyntaxKind.ExclamationToken

  private toScryptUnary(node: ts.Node, operator: ts.PrefixUnaryOperator): string {
    switch (operator) {
      case ts.SyntaxKind.PlusPlusToken:
        return '++';
      case ts.SyntaxKind.MinusMinusToken:
        return '--';
      case ts.SyntaxKind.MinusToken:
        return '-';
      case ts.SyntaxKind.ExclamationToken:
        return '!';
      default:
        throw new TranspileError(
          `Untransformable prefix unary operator kind ${ts.SyntaxKind[operator]
          } in: ${node.getText()}`,
          this.getRange(node),
        );
    }
  }

  private type2ResolvedName(type: ts.Type): string {
    // for basic types
    if (!type.symbol) {
      const typeName = this._checker.typeToString(
        type,
        undefined,
        ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
      );

      return typeName;
    }

    let typeName = type.symbol.escapedName.toString();

    // get scrypt struct name which might be a type alias or interface
    if (typeName === '__type') {
      typeName = type.aliasSymbol?.escapedName.toString() || typeName;
    }

    return typeName === 'boolean' ? 'Bool' : typeName;
  }

  private getResolvedTypeName(node: ts.Node): string {
    const type: ts.Type = this._checker.getTypeAtLocation(node);
    return this.type2ResolvedName(type);
  }

  // check if a call expression is a method call to a certain class's instance.
  private isCertainClassPropertyAccessExpr(
    expr: ts.PropertyAccessExpression,
    clazz: string,
  ): boolean {
    const objExpr = expr.expression;
    return this.getResolvedTypeName(objExpr) === clazz;
  }

  private transformStringLiteralExpression(
    node: ts.StringLiteral,
    toSection: EmittedSection,
  ): EmittedSection {
    if (node.parent.kind === ts.SyntaxKind.CallExpression) {
      const srcLoc = this.getCoordinates(node.getStart());
      const parent: ts.CallExpression = node.parent as ts.CallExpression;

      if (allowByteStringLiteral(parent)) {
        if (parent.expression.getText() === 'toByteString') {
          let literal = parent.arguments[0].getText();
          literal = literal.substring(1, literal.length - 1);
          if (parent.arguments.length == 1) {
            // one argument --> hex literal
            if (!/^([0-9a-fA-F]{2})*$/.test(literal)) {
              throw new TranspileError(
                `\`${literal}\` is not a valid hex literal`,
                this.getRange(node),
              );
            }
            toSection.append(`b'${literal}'`, srcLoc);
          } else {
            // two arguments
            const isUtf8 = parent.arguments[1].getText();
            if (isUtf8 === 'false') {
              // hex literal
              if (!/^([0-9a-fA-F]{2})*$/.test(literal)) {
                throw new TranspileError(
                  `\`${literal}\` is not a valid hex literal`,
                  this.getRange(node),
                );
              }
              toSection.append(`b'${literal}'`, srcLoc);
            } else if (isUtf8 === 'true') {
              // utf8 literal
              // Auto escape double quotes.
              const escaped = literal.replace(/"/g, '\\"');
              toSection.append(`"${escaped}"`, srcLoc);
            } else {
              throw new TranspileError(
                'Only boolean literal can be passed to the second parameter of `toByteString`',
                this.getRange(node),
              );
            }
          }
        } else {
          try {
            checkByteStringLiteral(node);
          } catch (error) {
            throw new TranspileError(error.message, this.getRange(node));
          }
        }
      } else {
        throw new TranspileError(
          `String literal ${node.getText()} is not allowed here, please use \`toByteString\` instead`,
          this.getRange(node),
        );
      }
    } else {
      throw new TranspileError(
        `String literal ${node.getText()} is not allowed here, please use \`toByteString\` instead`,
        this.getRange(node),
      );
    }
    return toSection;
  }

  private transformBigIntLiteralExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    let text = node.getText();
    text = text.replaceAll(/[_n]/g, '');
    return toSection.append(`${text}`, this.getCoordinates(node.getStart()));
  }

  private transformArrayLiteralExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ArrayLiteralExpression;
    return toSection
      .append('[')
      .appendWith(this, (toSec) => {
        e.elements.forEach((arg, index) => {
          toSec
            .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
            .append(index < e.elements.length - 1 ? ', ' : '');
        });
        return toSec;
      })
      .append(']');
  }

  private transformObjectLiteralExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ObjectLiteralExpression;
    toSection.append('{', this.getCoordinates(e.getStart()));
    const type = this._checker.getContextualType(e);
    if (type) {
      const members: string[] = [];
      type.getProperties().forEach((property) => members.push(property.getName()));
      members.forEach((member, index) => {
        const property = e.properties.find((property) => property.name!.getText() === member);
        if (property) {
          const _property: ts.PropertyAssignment = property as ts.PropertyAssignment;
          if (_property.initializer) {
            toSection
              .appendWith(this, (toSec) => this.transformExpression(_property.initializer, toSec))
              .append(index < members.length - 1 ? ', ' : '');
          } else {
            toSection
              .append(_property.name.getText())
              .append(index < members.length - 1 ? ', ' : '');
          }
        } else {
          const structname =
            type.symbol === undefined
              ? this._checker.typeToString(
                type,
                undefined,
                ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
              )
              : (type.aliasSymbol === undefined
                ? type.symbol.escapedName
                : type.aliasSymbol.escapedName
              ).toString();
          throw new TranspileError(
            `field not found for struct '${structname}': '${property!.getText()}'`,
            this.getRange(e),
          );
        }
      });
    } else {
      throw new TranspileError(`Untransformable expression: '${e.getText()}'`, this.getRange(e));
    }
    return toSection.append('}');
  }

  private transformIdentifierExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const nodeType = this._checker.getTypeAtLocation(node);
    if (
      nodeType.symbol &&
      [ts.SymbolFlags.Class, ts.SymbolFlags.ConstEnum, ts.SymbolFlags.RegularEnum].includes(
        nodeType.symbol.getFlags(),
      )
    ) {
      this.saveSymbol(nodeType.symbol.getName(), nodeType.symbol);

      // if (node.getText() === 'Utils') {
      //   toSection.append('__scrypt_Utils', this.getCoordinates(node.getStart()));
      //   return toSection;
      // } else if (node.getText() === 'SigHashUtils') {
      //   toSection.append('ContextUtils', this.getCoordinates(node.getStart()));
      //   return toSection;
      // }
    }

    // if (node.getText() === 'ZEROSAT') {
    //   toSection.append('__scrypt_Utils.ZEROSAT', this.getCoordinates(node.getStart()));
    //   return toSection;
    // }

    if (this.isCtcIdentifierOrProperty(node)) {
      return this.transformCtcNode(node, toSection);
    }

    if (this.isTranspilingConstructor(node) && this.isTranspilingBaseContract(node)) {
      const mapedNode = this._constructorParametersMap.get(node.getText());

      if (mapedNode) {
        if (ts.isParameter(mapedNode)) {
          toSection.append(mapedNode.name.getText(), this.getCoordinates(node.getStart()));
          return toSection;
        } else if (ts.isExpression(mapedNode)) {
          toSection.appendWith(this, (toSec) => this.transformExpression(mapedNode, toSec));
          return toSection;
        }
      }
    }
    toSection.append(node.getText(), this.getCoordinates(node.getStart()));
    return toSection;
  }

  private isBooleanType(node: ts.Expression): boolean {
    return (
      ['true', 'false', 'never', 'boolean', 'Bool'].indexOf(this.getResolvedTypeName(node)) !== -1
    );
  }

  private transformBinaryExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.BinaryExpression;
    const operator = this.toScryptBinary(e, e.operatorToken.getText());
    if (e.operatorToken.getText() === '&&' || e.operatorToken.getText() === '||') {
      // require both operands are boolean type
      if (!this.isBooleanType(e.left) || !this.isBooleanType(e.right)) {
        throw new TranspileError(
          `\`${node.getText()}\` is not allowed, both operands of \`${e.operatorToken.getText()}\` must be boolean type`,
          this.getRange(node),
        );
      }
    }
    const srcLoc = this.getCoordinates(e.getStart())!;
    return this.transformBinaryOperation(operator, e.left, e.right, srcLoc, toSection);
  }

  private transformSpecialPropertyAccessExpression(
    node: ts.PropertyAccessExpression,
    toSection: EmittedSection,
  ): boolean {
    const text = node.getText().replaceAll('?', '');
    let isSpecial = true;
    let shouldAccessThis = false;
    switch (text) {
      case 'SigHash.ALL':
        toSection.append('SigHash.ALL | SigHash.FORKID', this.getCoordinates(node.name.getStart()));
        break;
      case 'SigHash.NONE':
        toSection.append(
          'SigHash.NONE | SigHash.FORKID',
          this.getCoordinates(node.name.getStart()),
        );
        break;
      case 'SigHash.SINGLE':
        toSection.append(
          'SigHash.SINGLE | SigHash.FORKID',
          this.getCoordinates(node.name.getStart()),
        );
        break;
      case 'SigHash.ANYONECANPAY_ALL':
        toSection.append(
          'SigHash.ALL | SigHash.ANYONECANPAY | SigHash.FORKID',
          this.getCoordinates(node.name.getStart()),
        );
        break;
      case 'SigHash.ANYONECANPAY_NONE':
        toSection.append(
          'SigHash.NONE | SigHash.ANYONECANPAY | SigHash.FORKID',
          this.getCoordinates(node.name.getStart()),
        );
        break;
      case 'SigHash.ANYONECANPAY_SINGLE':
        toSection.append(
          'SigHash.SINGLE | SigHash.ANYONECANPAY | SigHash.FORKID',
          this.getCoordinates(node.name.getStart()),
        );
        break;
      case 'this.changeInfo':
        shouldAccessThis = this.shouldAutoAppendChangeAmount(
          this.getMethodContainsTheNode(node),
        ).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_ChangeInfo}`);
        break;
      // ctx: SH Preimage
      case 'this.ctx.nVersion':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.nVersion`);
        break;
      case 'this.ctx.hashPrevouts':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashPrevouts`);
        break;
      case 'this.ctx.spentScriptHash':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.spentScriptHash`);
        break;
      case 'this.ctx.spentDataHash':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.spentDataHash`);
        break;
      case 'this.ctx.value':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.value`);
        break;
      case 'this.ctx.nSequence':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.nSequence`);
        break;

      case 'this.ctx.hashSpentAmounts':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashSpentAmounts`);
        break;
      case 'this.ctx.hashSpentScriptHashes':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashSpentScriptHashes`);
        break;
      case 'this.ctx.hashSpentDataHashes':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashSpentDataHashes`);
        break;
      case 'this.ctx.hashSequences':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashSequences`);
        break;
      case 'this.ctx.hashOutputs':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashOutputs`);
        break;
      case 'this.ctx.inputIndex':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.inputIndex`);
        break;
      case 'this.ctx.nLockTime':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.nLockTime`);
        break;
      case 'this.ctx.sigHashType':
        shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.sigHashType`);
        break;

      // ParamCtx
      case 'this.ctx.prevouts':
        // toSection.append(`${InjectedParam_Prevouts}`);
        shouldAccessThis = this.shouldAutoAppendPrevouts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_Prevouts}`);
        break;
      case 'this.ctx.spentScriptHashes':
        // toSection.append(`${InjectedParam_SpentScriptHashes}`);
        shouldAccessThis = this.shouldAutoAppendSpentScripts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(shouldAccessThis
          ? `this.${InjectedParam_SpentScriptHashes}`
          : `${InjectedParam_SpentScriptHashes}`);
        break;
      case 'this.ctx.spentDataHashes':
        // toSection.append(`${InjectedParam_SpentScriptHashes}`);
        shouldAccessThis = this.shouldAutoAppendSpentDataHashes(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(shouldAccessThis
          ? `this.${InjectedParam_SpentDataHashes}`
          : `${InjectedParam_SpentDataHashes}`);
        break;
      case 'this.ctx.spentAmounts':
        // toSection.append(`${InjectedParam_SpentAmounts}`);
        shouldAccessThis = this.shouldAutoAppendSpentAmounts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(shouldAccessThis
          ? `this.${InjectedParam_SpentAmounts}`
          : `${InjectedParam_SpentAmounts}`);
        break;

      case 'this.ctx.prevout':
        // toSection.append(`${InjectedParam_Prevout}`);
        shouldAccessThis = this.shouldAutoAppendPrevouts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_Prevout}`);
        break;
      case 'this.ctx.inputCount':
        shouldAccessThis = this.shouldAutoAppendSpentAmounts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(shouldAccessThis
          ? ACCESS_INPUT_COUNT.accessThis
          : ACCESS_INPUT_COUNT.accessArgument);
        break;
      case 'this.ctx':
        shouldAccessThis = this.shouldAutoAppendPrevouts(this.getMethodContainsTheNode(node)).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}`);
        break;
      case 'this.state':
        shouldAccessThis = this.shouldAutoAppendStateArgs(
          this.getMethodContainsTheNode(node),
        ).shouldAccessThis;
        toSection.append(`${shouldAccessThis ? 'this.' : ''}${InjectedProp_NextState}`);
        break;
      default: {
        isSpecial = false;
      }
    }
    return isSpecial;
  }

  private transformCTCPropertyAccessExpression(
    node: ts.PropertyAccessExpression,
    toSection: EmittedSection,
  ): boolean {
    if (ts.isIdentifier(node.name) && ts.isIdentifier(node.expression)) {
      if (this.isCtcIdentifierOrProperty(node)) {
        this.transformCtcNode(node, toSection);
        return true;
      }
    }
    return false;
  }

  private transformPropertyAccessExpression(
    node: ts.PropertyAccessExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    if (this.transformSpecialPropertyAccessExpression(node, toSection)) {
      return toSection;
    }

    if (this.transformCTCPropertyAccessExpression(node, toSection)) {
      return toSection;
    }

    const name = node.name.getText();

    const cls = Transpiler.getClassDeclaration(node)!;

    if (this.isNonPropReferences(cls, name)) {
      throw new TranspileError(
        `Cannot access Non-Prop property '${name}' in a \`@method()\` function`,
        this.getRange(node),
      );
    }

    if (ts.isIdentifier(node.expression)) {
      const leftSide = node.expression.getText();

      if (leftSide === this.currentbaseContractName) {
        toSection.append(
          `${this.currentContractName}.${node.name.getText()}`,
          this.getCoordinates(node.name.getStart()),
        );

        return toSection;
      }
    }

    toSection
      .appendWith(this, (toSec) => this.transformExpression(node.expression, toSec))
      .append(`.${node.name.getText()}`, this.getCoordinates(node.name.getStart()));

    return toSection;
  }

  private transformArrowFunctionExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ArrowFunction;
    if (ts.isBlock(e.body)) {
      if (e.parameters.length > 1) {
        throw new TranspileError(
          `Untransformable expression kind ${ts.SyntaxKind[e.kind]}: '${e.getText()}'`,
          this.getRange(e),
        );
      }
      if (e.parameters.length === 1) {
        toSection.append(` : ${e.parameters[0].name.getText()}`);
      }
      toSection.append(' ');
      return this.transformStatement(e.body, toSection);
    }
    throw new TranspileError(
      `Untransformable expression kind ${ts.SyntaxKind[e.kind]}: '${e.getText()}'`,
      this.getRange(e),
    );
  }

  private transformNewExpression(node: ts.Expression, toSection: EmittedSection): EmittedSection {
    const e = node as ts.NewExpression;
    const clsText = e.expression.getText();
    const scryptType = getBuiltInType(clsText);
    if (scryptType) {
      toSection.append(scryptType, this.getCoordinates(e.getStart())).append('(');

      if (clsText === 'SigHashType' && e.arguments![0].kind) {
        const t = parseInt(e.arguments![0].getText());
        toSection.append(`b'${number2hex(t)}'`);
      } else {
        e.arguments!.forEach((arg, index) => {
          toSection
            .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
            .append(index < e.arguments!.length - 1 ? ', ' : '');
        });
      }
      toSection.append(')');
    } else {
      const type = this.getResolvedType(e.expression)!;
      const classDec = type.getSymbol()!.declarations![0] as ts.ClassDeclaration;

      // if this extends `SmartContract` or `SmartLibrary`
      if (this.isLibrary(classDec)) {
        toSection
          .append('new ')
          .append(e.expression.getText(), this.getCoordinates(e.expression.getStart()))
          .append('(')
          .appendWith(this, (toSec) => {
            e.arguments!.forEach((arg, index) => {
              toSec
                .appendWith(this, (ts) => this.transformExpression(arg, ts))
                .append(index < e.arguments!.length - 1 ? ', ' : '');
            });
            return toSec;
          })
          .append(')');
      } else if (this.isContract(classDec)) {
        throw new TranspileError(
          `contract \`${e.expression.getText()}\` can not be initialized inside a @method, only supports instantiation of library`,
          this.getRange(e),
        );
      } else {
        throw new TranspileError(
          `Untransformable expression kind ${ts.SyntaxKind[e.kind]}: '${e.getText()}'`,
          this.getRange(e),
        );
      }
    }
    return toSection;
  }

  private transformElementAccessExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ElementAccessExpression;
    if (this.getResolvedTypeName(e.expression) === 'ByteString') {
      // ByteString[] is not allowed
      throw new TranspileError(
        `\`${node.getText()}\` is not allowed here, slice ByteString is not supported`,
        this.getRange(e),
      );
    }

    return toSection
      .appendWith(this, (toSec) => this.transformExpression(e.expression, toSec))
      .append('[')
      .appendWith(this, (toSec) => this.transformExpression(e.argumentExpression, toSec))
      .append(']');
  }

  private transformConditionalExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ConditionalExpression;
    return toSection
      .appendWith(this, (toSec) => this.transformExpression(e.condition, toSec))
      .append(' ? ')
      .appendWith(this, (toSec) => this.transformExpression(e.whenTrue, toSec))
      .append(' : ')
      .appendWith(this, (toSec) => this.transformExpression(e.whenFalse, toSec));
  }

  private transformParenthesizedExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.ParenthesizedExpression;
    return toSection
      .append('(')
      .appendWith(this, (toSec) => this.transformExpression(e.expression, toSec))
      .append(')');
  }

  private transformPostfixUnaryExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.PostfixUnaryExpression;
    return toSection
      .appendWith(this, (toSec) => this.transformExpression(e.operand, toSec))
      .append(
        `${e.operator == ts.SyntaxKind.PlusPlusToken ? '++' : '--'}`,
        this.getCoordinates(e.getStart()),
      );
  }

  private transformPrefixUnaryExpression(
    node: ts.Expression,
    toSection: EmittedSection,
  ): EmittedSection {
    const e = node as ts.PrefixUnaryExpression;
    if (e.operator === ts.SyntaxKind.ExclamationToken) {
      // require boolean
      if (!this.isBooleanType(e.operand)) {
        throw new TranspileError(
          `\`${node.getText()}\` is not allowed, operand of \`!\` must be boolean type`,
          this.getRange(node),
        );
      }
    }
    return toSection
      .append(`${this.toScryptUnary(e, e.operator)}`, this.getCoordinates(e.getStart()))
      .appendWith(this, (toSec) => this.transformExpression(e.operand, toSec));
  }

  private transformCallExpression(node: ts.Expression, toSection: EmittedSection): EmittedSection {
    const e = node as ts.CallExpression;
    if (e.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
      // E.g. "str1.slice(2, 6)"
      return this.transformPropertyAccessCallExpression(e, toSection);
    }
    if (e.expression.kind === ts.SyntaxKind.Identifier) {
      // E.g. "assert(...)"
      return this.transformIdentifierCallExpression(e, toSection);
    }
    return this.transformDefaultCallExpression(e, toSection);
  }

  private transformBinaryOperation(
    operator: string,
    left: ts.Expression,
    right: ts.Expression,
    srcLoc: ts.LineAndCharacter,
    toSection: EmittedSection,
    parenthesized: boolean = false,
  ): EmittedSection {
    if (parenthesized) {
      toSection.append('(', srcLoc);
    }
    toSection
      .appendWith(this, (toSec) => this.transformExpression(left, toSec))
      .append(` ${operator} `, srcLoc)
      .appendWith(this, (toSec) => this.transformExpression(right, toSec));
    if (parenthesized) {
      toSection.append(')', srcLoc);
    }
    return toSection;
  }

  private transformPropertyAccessCallExpression(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const expr = node.expression as ts.PropertyAccessExpression;
    const name = expr.name.getText();
    const leftSide = expr.expression.getText();

    if (leftSide === 'this') {
      if (name === 'checkSig') {
        return this.transformCallCheckSig(node, toSection);
      }
      if (name === 'checkMultiSig') {
        return this.transformCallCheckMultiSig(node, toSection);
      }
      if (name === 'checkPreimage' || name === 'checkPreimageSigHashType') {
        return this.transformCallCheckPreimage(node, toSection);
      }
      if (name === 'buildChangeOutput') {
        return this.transformCallBuildChangeOutput(node, toSection);
      }

      if (name === 'timeLock') {
        return this.transformCallCLTV(node, toSection);
      }

      if (name === 'checkInputState') {
        return this.transformCallCheckInputState(node, toSection);
      }

      if (name === 'backtraceToOutpoint') {
        return this.transformCallBacktraceToOutpoint(node, toSection);
      }

      if (name === 'backtraceToScript') {
        return this.transformCallBacktraceToScript(node, toSection);
      }

      if (name === 'checkOutputs') {
        return this.transformCallCheckOutputs(node, toSection);
      }

      return this.transformDefaultCallExpression(node, toSection);
    }

    if (name === 'slice') {
      return this.transformCallSlice(node);
    }

    return this.transformDefaultCallExpression(node, toSection);
  }

  private transformIdentifierCallExpression(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const srcLoc = this.getCoordinates(node.getStart())!;
    const name = node.expression.getText();

    if (name === 'assert') {
      return toSection
        .append('require(', srcLoc)
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
        .append(')');
    }
    if (name === 'BigInt' || name === 'Number') {
      toSection.append('(', srcLoc);
      node.arguments.forEach((arg) => {
        toSection.appendWith(this, (toSec) => this.transformExpression(arg, toSec));
      });
      return toSection.append(')');
    }
    if (name === 'and') {
      return this.transformBinaryOperation(
        '&',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
        true,
      );
    }
    if (name === 'or') {
      return this.transformBinaryOperation(
        '|',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
        true,
      );
    }
    if (name === 'xor') {
      return this.transformBinaryOperation(
        '^',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
        true,
      );
    }
    if (name === 'invert') {
      return toSection
        .append('~', srcLoc)
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec));
    }
    if (name === 'lshift') {
      return this.transformBinaryOperation(
        '<<',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
        true,
      );
    }
    if (name === 'rshift') {
      return this.transformBinaryOperation(
        '>>',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
        true,
      );
    }
    if (name === 'equals') {
      return this.transformBinaryOperation(
        '==',
        node.arguments[0],
        node.arguments[1],
        srcLoc,
        toSection,
      );
    }
    if (name === 'toByteString') {
      const arg0 = node.arguments[0];
      if (arg0.kind === ts.SyntaxKind.StringLiteral || this.isByteStringNode(arg0)) {
        return toSection.appendWith(this, (toSec) => this.transformExpression(arg0, toSec));
      }
      throw new TranspileError(
        'Only string literal can be passed to the first parameter of `toByteString`',
        this.getRange(node),
      );
    }
    if (name === 'PubKeyHash' || name === 'Addr') {
      return toSection
        .append('Ripemd160', srcLoc)
        .append('(')
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
        .append(')');
    }


    // if (name === 'SigHashType') {
    //   return this.transformCallSigHashType(node, toSection);
    // }
    if (name === 'reverseByteString') {
      toSection.append('reverseBytes(', srcLoc);
      node.arguments.forEach((arg, index) => {
        toSection
          .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
          .append(index < node.arguments.length - 1 ? ', ' : '');
      });
      return toSection.append(')');
    }
    if (name === 'intToByteString') {
      let func = node.arguments.length === 1 ? 'pack' : 'num2bin'
      toSection.append(`${func}(`, srcLoc);
      node.arguments.forEach((arg, index) => {
        toSection
          .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
          .append(index < node.arguments.length - 1 ? ', ' : '');
      });
      return toSection.append(')');
    }
    if (name === 'byteStringToInt') {
      toSection.append(`unpack(`, srcLoc);
      node.arguments.forEach((arg, index) => {
        toSection
          .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
          .append(index < node.arguments.length - 1 ? ', ' : '');
      });
      return toSection.append(')');
    }
    if (name === 'fill') {
      return this.transformCallFill(node, toSection);
    }
    if (name === 'slice') {
      return this.transformIdentifierCallSlice(node, toSection);
    }
    if (name === 'pubKey2Addr') {
      return toSection
        .append('hash160', srcLoc)
        .append('(')
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
        .append(')');
    }
    return this.transformDefaultCallExpression(node, toSection);
  }

  private transformDefaultCallExpression(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const funcType = this._checker.getTypeAtLocation(node.expression);
    if (funcType.flags === ts.TypeFlags.Any) {
      throw new TranspileError(
        `Calling function which returns \`any\` is not allowed`,
        this.getRange(node.expression),
      );
    }

    const text = node.getText().replaceAll('?', '');
    switch (text) {
      case 'this.insertCodeSeparator()':
        {
          const ifStmt = Transpiler.getIfStatement(node);

          if (ifStmt) {
            throw new TranspileError(
              `insertCodeSeparator() cannot be called in a if statement`,
              this.getRange(node),
            );
          }

          const md = Transpiler.getMethodDeclaration(node);

          if (md) {
            if (!Transpiler.isPublicMethod(md)) {
              throw new TranspileError(
                `non-public methods cannot call insertCodeSeparator()`,
                this.getRange(node),
              );
            }

            const methodInfo = this.findMethodInfo(md.name.getText());
            if (methodInfo) {
              methodInfo.codeSeparatorCount++;
            }
          }

          toSection.append(`***`, this.getCoordinates(node.getStart()));
          toSection.skipNextAppend = true; // "***" is not closed using semicolon
        }
        break;
      default:
        toSection
          .appendWith(this, (toSec) => this.transformExpression(node.expression, toSec))
          .append('(')
          .appendWith(this, (toSec) => {
            const methodDec = funcType.symbol.declarations![0] as ts.FunctionDeclaration;
            const inValidParams = methodDec.parameters.find(
              (p) => p.type?.getText() === 'SmartContract',
            );
            if (inValidParams) {
              throw new TranspileError(
                `Untransformable parameter: '${node.getText()}'`,
                this.getRange(node),
              );
            }
            node.arguments.forEach((arg, index) => {
              toSec
                .appendWith(this, (ts) => this.transformExpression(arg, ts))
                .append(index < node.arguments.length - 1 ? ', ' : '');
            });
            return toSec;
          })
          .append(')');
        break;
    }

    return toSection;
  }

  private transformCallSlice(node: ts.CallExpression): EmittedSection {
    // disable ByteString.slice()
    const msg = `\`${node.getText()}\` is not allowed here, slice ByteString is not supported`;
    throw new TranspileError(msg, this.getRange(node));
  }

  private transformIdentifierCallSlice(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    toSection
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append('[')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[1], toSec))
      .append(' : ');

    if (node.arguments.length === 3) {
      toSection.appendWith(this, (toSec) => this.transformExpression(node.arguments[2], toSec));
    } else {
      toSection
        .append('len(')
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
        .append(')');
    }

    return toSection.append(']');
  }

  private transformCallCLTV(node: ts.CallExpression, toSection: EmittedSection): EmittedSection {
    const shouldAccessThis = this.shouldAutoAppendSighashPreimage(this.getMethodContainsTheNode(node)).shouldAccessThis;
    return toSection.append(
      `ContextUtils.checknLockTime(${shouldAccessThis ? 'this.' : ''}${InjectedProp_SHPreimage},`,
    )
    .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
    .append(')');
  }

  private transformCallCheckSig(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const srcLoc = this.getCoordinates(node.getStart());
    toSection.appendWith(this, (toSec) => {
      const _e: ts.PropertyAccessExpression = node.expression as ts.PropertyAccessExpression;
      return this.transformExpression(_e.name, toSec);
    });
    toSection.append('(', srcLoc);

    const args = node.arguments.slice(0, 2);
    args.forEach((arg, index) => {
      toSection
        .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
        .append(index < args.length - 1 ? ', ' : '');
    });
    return toSection.append(')', srcLoc);
  }

  private transformCallCheckMultiSig(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const srcLoc = this.getCoordinates(node.getStart());
    toSection.appendWith(this, (toSec) => {
      const _e: ts.PropertyAccessExpression = node.expression as ts.PropertyAccessExpression;
      return this.transformExpression(_e.name, toSec);
    });
    toSection.append('(', srcLoc);

    const args = node.arguments.slice(0, 2);
    args.forEach((arg, index) => {
      toSection
        .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
        .append(index < args.length - 1 ? ', ' : '');
    });
    return toSection.append(')', srcLoc);
  }

  private transformCallCheckPreimage(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const srcLoc = this.getCoordinates(node.getStart());
    toSection.appendWith(this, (toSec) => {
      const _e: ts.PropertyAccessExpression = node.expression as ts.PropertyAccessExpression;
      toSec.append('Tx.');
      return this.transformExpression(_e.name, toSec);
    });
    toSection.append('(', srcLoc);

    node.arguments.forEach((arg, index) => {
      toSection
        .appendWith(this, (toSec) => this.transformExpression(arg, toSec))
        .append(index < node.arguments.length - 1 ? ', ' : '');
    });
    return toSection.append(')', srcLoc);
  }

  private transformCallBuildPublicKeyHashOutput(
    node: ts.CallExpression,
    toSection: EmittedSection,
    name: string,
  ): EmittedSection {
    if (node.arguments.length !== 2) {
      throw new TranspileError(`Invalid arguments length for ${name}`, this.getRange(node));
    }
    return toSection
      .append(
        `Utils.buildOutput(Utils.buildPublicKeyHashScript(`,
        this.getCoordinates(node.getStart()),
      )
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append('), ')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[1], toSec))
      .append(')');
  }

  private transformCallBuildAddressScript(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    if (node.arguments.length !== 1) {
      throw new TranspileError(
        `Invalid arguments length for buildAddressScript`,
        this.getRange(node),
      );
    }
    return toSection
      .append(`Utils.buildPublicKeyHashScript(`, this.getCoordinates(node.getStart()))
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(')');
  }

  private transformCallFill(node: ts.CallExpression, toSection: EmittedSection): EmittedSection {
    const _length = node.arguments[1];
    const isCtc = this.isCtcExpression(_length);
    if (_length.kind !== ts.SyntaxKind.NumericLiteral && !isCtc) {
      throw new TranspileError(
        'Only compiled-time constant can be passed to the second parameter of `fill`',
        this.getRange(node),
      );
    }
    return toSection
      .append('repeat(', this.getCoordinates(node.getStart()))
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(', ')
      .appendWith(this, (toSec) =>
        isCtc && !this.isParameterNode(node.arguments[1])
          ? this.transformCtcExpr(_length, toSec)
          : this.transformExpression(_length, toSec),
      )
      .append(')');
  }

  private transformCallSigHashType(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    return toSection
      .append('SigHashType', this.getCoordinates(node.getStart()))
      .append('(')
      .appendWith(this, (toSec) => {
        if (node.arguments[0].kind !== ts.SyntaxKind.NumericLiteral) {
          throw new TranspileError(
            `Only support numeric literal: [65,66,67,193,194,195]`,
            this.getRange(node),
          );
        }
        const n: ts.NumericLiteral = node.arguments[0] as ts.NumericLiteral;
        const val = parseInt(n.getText());
        if ([65, 66, 67, 193, 194, 195].includes(val)) {
          return toSec.append(`b'${val.toString(16)}'`);
        }
        throw new TranspileError(
          `Only support numeric literal: [65,66,67,193,194,195]`,
          this.getRange(node),
        );
      })
      .append(')');
  }

  private transformCallBuildChangeOutput(
    _node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const methodNode = this.getMethodContainsTheNode(_node);
    const { shouldAccessThis } = this.shouldAutoAppendChangeAmount(methodNode);
    this._accessBuiltinsSymbols.add('TxUtils');
    return toSection
      .append('\n')
      .append(
        shouldAccessThis
          ? CALL_BUILD_CHANGE_OUTPUT.accessThis
          : CALL_BUILD_CHANGE_OUTPUT.accessArgument,
      );
  }


  private transformCallCheckInputState(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const dynamicInputIndex = this.isDynamicIndex(node.arguments[0]);

    const randomId = Math.random().toString(36).substring(2, 15);
    const inputIndexVar = `__scrypt_ts_input_index_${randomId}`;

    if (dynamicInputIndex) {
      // declare a new input index variable
      toSection
        .append(`int ${inputIndexVar} = `, this.getCoordinates(node.arguments[0].getStart()))
        .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
        .append(';\n');
    }

    // call `StateUtils.checkInputState`
    this._accessBuiltinsSymbols.add('StateUtils');
    return toSection
      .append('\n')
      .append(`StateUtils.checkInputState(`)
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(', ')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[1], toSec))
      .append(', ')
      .appendWith(this, (toSec) => {
        const shouldAccessThis = this.shouldAutoAppendStateArgs(
          this.getMethodContainsTheNode(node),
        ).shouldAccessThis;
        toSec.append(shouldAccessThis
          ? `this.${InjectedParam_SpentDataHashes}`
          : `${InjectedParam_SpentDataHashes}`);

          return toSec;
      })
      .append(');')
      .append('\n');
  }

  private transformCallBacktraceToOutpoint(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const methodNode = this.getMethodContainsTheNode(node);
    const { shouldAccessThis } = this.shouldAutoAppendSighashPreimage(methodNode);
    this._accessBuiltinsSymbols.add('Backtrace');


    const spentScriptHashes = `${shouldAccessThis ? 'this.' : ''}${InjectedParam_SpentScriptHashes}`;
    const inputIndex = `${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.inputIndex`;

    return toSection
      .append('Backtrace.verifyFromOutpoint(')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(', ')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[1], toSec))
      .append(', ')
      .append(
        `${spentScriptHashes}[${inputIndex} * 32 : (${inputIndex} + 1) * 32]`,
      )
      .append(', ')
      .appendWith(this, (toSec) => {
        return this.transformAccessPrevTxHashPreimage(node, toSec).append(
          `.inputList`,
        );
      })
      .append(')');
  }

  private transformCallBacktraceToScript(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const methodNode = this.getMethodContainsTheNode(node);
    const { shouldAccessThis } = this.shouldAutoAppendSighashPreimage(methodNode);
    this._accessBuiltinsSymbols.add('Backtrace');
    const spentScriptHashes = `${shouldAccessThis ? 'this.' : ''}${InjectedParam_SpentScriptHashes}`;
    const inputIndex = `${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.inputIndex`;
    return toSection
      .append('Backtrace.verifyFromScript(')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(', ')
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[1], toSec))
      .append(', ')
      .append(
        `${spentScriptHashes}[${inputIndex} * 32 : (${inputIndex} + 1) * 32]`,
      )
      .append(', ')
      .appendWith(this, (toSec) => {
        return this.transformAccessPrevTxHashPreimage(node, toSec).append(
          `.inputList`,
        );
      })
      .append(')');
  }

  // private transformAccessCurInputStateProof(
  //   node: ts.Node,
  //   toSection: EmittedSection,
  // ): EmittedSection {
  //   const methodName = `${this._currentContract.name.escapedText.toString()}.${this._currentMethodName}`;
  //   const methodInfo = this.methodInfos.get(methodName);
  //   if (!methodInfo) {
  //     throw new Error(`Method info not found for ${methodName}`);
  //   }

  //   const methodNode = this.getMethodContainsTheNode(node);
  //   const { shouldAccessThis } = this.shouldAutoAppendStateArgs(methodNode);

  //   const expr = methodInfo.accessInfo.accessInputStateProofs
  //     ? `${shouldAccessThis ? INPUT_STATE_PROOF_EXPR.accessThis(InjectedParam_InputIndexVal) : INPUT_STATE_PROOF_EXPR.accessArgument(InjectedParam_InputIndexVal)}`
  //     : `${shouldAccessThis ? 'this.' : ''}${InjectedParam_InputStateProof}`;
  //   return toSection.append(expr);
  // }

  private transformAccessPrevTxHashPreimage(
    node: ts.Node,
    toSection: EmittedSection,
  ): EmittedSection {
    const methodNode = this.getMethodContainsTheNode(node);
    const methodInfo = this.findMethodInfo(methodNode.name.getText());
    if (!methodInfo) {
      throw new Error(`Method info not found for ${methodNode.name.getText()}`);
    }
    const { shouldAccessThis } = this.shouldAutoAppendPrevTxHashPreimageArgs(methodNode);
    const expr = shouldAccessThis ? `this.${InjectedProp_PrevTxHashPreimage}` : InjectedProp_PrevTxHashPreimage;
    return toSection.append(expr);
  }
  
  private isDynamicIndex(node: ts.Expression): boolean {
    const indexExpr = this.unwrapNumberConversion(node);
    return (
      !this.isCtcExpression(indexExpr) &&
      !ts.isForStatement(
        this._checker.getSymbolAtLocation(indexExpr)?.declarations[0]?.parent?.parent,
      )
    );
  }

  private unwrapNumberConversion(node: ts.Expression): ts.Expression {
    // BigInt(x) => x, Number(x) => x
    if (ts.isCallExpression(node) && ['BigInt', 'Number'].includes(node.expression.getText())) {
      return node.arguments[0];
    }
    return node;
  }

  private transformCallCheckOutputs(
    node: ts.CallExpression,
    toSection: EmittedSection,
  ): EmittedSection {
    const methodNode = this.getMethodContainsTheNode(node);
    const { shouldAccessThis } = this.shouldAutoAppendSighashPreimage(methodNode);
    const hashOutputs = `${shouldAccessThis ? 'this.' : ''}${InjectedParam_SHPreimage}.hashOutputs`;

    return toSection
      .append(`hash256(`)
      .appendWith(this, (toSec) => this.transformExpression(node.arguments[0], toSec))
      .append(`) == ${hashOutputs}`);
  }
}
