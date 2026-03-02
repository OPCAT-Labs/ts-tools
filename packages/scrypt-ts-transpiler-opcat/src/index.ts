import * as path from 'path';
import ts from 'typescript';
import { Indexer } from './indexer';
import { Transpiler } from './transpiler';
import { PluginConfig, ProgramTransformerExtras } from 'ts-patch';
import { mkdirSync } from 'fs';
import { existsSync } from 'fs';
import { Relinker, TEMPLATE_FOLDER_NAME } from './relinker';
/***
 * @ignore
 */
const allMissImportedLocalSymbols = new Map<ts.SourceFile, Map<string, ts.Symbol>>();

/***
 * @ignore
 */
const allContractsAST = new Map<string, ts.ClassDeclaration>();

let relinker: Relinker = null;

// `patchHost` code from ts-patch maintainer https://github.com/nonara/ts-patch/discussions/29
function getPatchedHost(
  maybeHost: ts.CompilerHost | undefined,
  tsInstance: typeof ts,
  compilerOptions: ts.CompilerOptions
): ts.CompilerHost & { fileCache: Map<string, ts.SourceFile> } {
  const fileCache = new Map();
  const compilerHost = maybeHost ?? tsInstance.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = compilerHost.getSourceFile;

  return Object.assign(compilerHost, {
    getSourceFile(fileName: string, languageVersion: ts.ScriptTarget) {
      fileName = (tsInstance as any).normalizePath(fileName);
      if (fileCache.has(fileName)) return fileCache.get(fileName);

      const sourceFile = originalGetSourceFile.apply(void 0, Array.from(arguments) as any);
      fileCache.set(fileName, sourceFile);

      return sourceFile;
    },
    fileCache
  });
}

/***
 * @ignore
 */
export default function transformProgram(
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  pluginOptions: PluginConfig,
  extras: ProgramTransformerExtras,
): ts.Program {

  let tsInstance: typeof ts


  // handle if host argument is missing
  if (!extras) {
    tsInstance = pluginOptions.ts;
    pluginOptions = host;
    host = getPatchedHost(undefined, tsInstance, program.getCompilerOptions());
  } else {
    tsInstance = extras.ts;
    host = getPatchedHost(host, tsInstance, program.getCompilerOptions());
  }

  const compilerOptions = program.getCompilerOptions();

  let tsconfigDir = process.env['TS_NODE_PROJECT']
    ? path.dirname(process.env['TS_NODE_PROJECT'])
    : '.';
  tsconfigDir = path.isAbsolute(tsconfigDir)
    ? tsconfigDir
    : path.join(program.getCurrentDirectory(), tsconfigDir);
  const tsRootDir = program.getCompilerOptions().rootDir ?? tsconfigDir;
  const jsOutDir = program.getCompilerOptions().outDir ?? tsconfigDir;
  const scryptOutDir = pluginOptions.outDir
    ? path.join(tsconfigDir, pluginOptions.outDir)
    : jsOutDir;

  if (pluginOptions.debug) {
    console.log('activate scrypt-ts transformer plugin');
    console.log('transformer loaded with options:', pluginOptions, '\n');
    console.log(Array(20).fill('*').join(''), 'path context', Array(20).fill('*').join(''));
    console.log(
      `tsRootDir:  ${tsRootDir}\ntsconfigDir: ${tsconfigDir}\njsOutDir: ${jsOutDir}\nscryptOutDir: ${scryptOutDir}`,
    );
    console.log(Array(50).fill('*').join(''), '\n');
  }

  const tplOutDir = path.join(scryptOutDir, TEMPLATE_FOLDER_NAME);
  if (!existsSync(tplOutDir)) {
    mkdirSync(tplOutDir, { recursive: true });
  }
  const indexer = Indexer.create(tsconfigDir, tplOutDir);
  const checker = program.getTypeChecker();

  /* Apply the transformation */
  tsInstance.transform(
    program.getSourceFiles() as ts.SourceFile[],
    [transformFile.bind(tsInstance, host, checker, tsRootDir, tplOutDir, indexer)],
    compilerOptions,
  );

  // add dummy transformer to avoid ts-patch error, https://github.com/nonara/ts-patch/issues/120
  let result: any = program;
  result.after = result.after || []
  result.before = result.before || []
  result.afterDeclarations = result.afterDeclarations || []

  return result
}

function transformFile(
  this: typeof ts,
  host: ts.CompilerHost | undefined,
  checker: ts.TypeChecker,
  tsRootDir: string,
  tplOutDir: string,
  indexer: Indexer,
  ctx: ts.TransformationContext,
) {
  return (sourceFile: ts.SourceFile) => {
    // skip declaration files of *.d.ts
    if (sourceFile.fileName.endsWith('.d.ts')) {
      return sourceFile;
    }
    const compilerOptions = ctx.getCompilerOptions();

    if (!relinker) {
      relinker = new Relinker(
        process.cwd(),
        indexer.scryptBasePath,
      );
    }
    const transpiler = new Transpiler(
      sourceFile,
      host,
      checker,
      tsRootDir,
      tplOutDir,  // output to .templates dir
      indexer,
      compilerOptions,
    );
    if (!transpiler.isTransformable()) {
      return sourceFile;
    }
    transpiler.transform(allMissImportedLocalSymbols, relinker);

    const scComponents = transpiler.getSCComponents();

    scComponents.forEach((cls) => {
      allContractsAST.set(cls.name!.getText(), cls);
    });

    return sourceFile;
  };
}

export { Indexer, Symbol, readArtifact } from './indexer';

export * from './compile/findCompiler';
export * from './compile/compilerWrapper';
export * from './compile/getBinary';
export * from './resolver';
export * from './relinker';
