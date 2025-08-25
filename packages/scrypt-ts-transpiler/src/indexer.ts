import { Artifact, SmartContract } from '@opcat-labs/scrypt-ts';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path, { dirname, join, relative, resolve } from 'path';
import { Range } from './types';
import { alterFileExt, filterUndefinedFields, toPosixPath } from './utils';
/**
 * @ignore
 */
export type Symbol = string & { __type: 'sCryptSymbol' };
export type FilePath = string;
export type Content = {
  scryptBase: string;
  bindings: { symbol: Symbol; path: FilePath; stateType?: Symbol; md5: string }[];
};

export const INDEX_FILE_NAME = 'scrypt.index.json';

/**
 * @ignore
 */
export class Indexer {
  // absolute file path of `scrypt.index.json`
  filePath: string;
  // relative path to scrypt base directory from the folder of `scrypt.index.json`
  scryptBasePath: string;
  symbolInfos: Map<
    Symbol,
    {
      md5: string;
      path: FilePath;
      stateType?: Symbol;
    }
  > = new Map();

  public static readonly TEMPLATE_FILE_NAME = '.templates';

  constructor(filePath?: FilePath) {
    // find indexer file of the contract
    const indexFile = filePath || join(process.cwd(), INDEX_FILE_NAME);
    this.filePath = indexFile;
    this.load();
  }

  setScryptBasePath(scryptBasePath: string) {
    this.scryptBasePath = scryptBasePath;
  }

  clean() {
    this.symbolInfos.clear();
  }

  load() {
    if (!existsSync(this.filePath)) {
      return;
    }
    const content: Content = JSON.parse(readFileSync(this.filePath).toString());
    if (!content.scryptBase) {
      throw new Error(`missing \`scryptBase\` in index file ${this.filePath}`);
    }
    this.scryptBasePath = content.scryptBase;

    if (!content.bindings) {
      throw new Error(`missing \`bindings\` in index file ${this.filePath}`);
    }
    content.bindings.forEach((binding) => {
      if (binding.symbol && binding.path) {
        this.symbolInfos.set(binding.symbol, {
          path: binding.path,
          md5: binding.md5,
          stateType: binding.stateType,
        });
      }
    });
  }

  getRelativePath(symbol: Symbol): FilePath | undefined {
    if (this.symbolInfos.has(symbol)) {
      return this.symbolInfos.get(symbol).path;
    }

    return undefined;
  }

  getMd5(symbol: Symbol): FilePath | undefined {
    if (this.symbolInfos.has(symbol)) {
      return this.symbolInfos.get(symbol).md5;
    }

    return undefined;
  }

  updateMd5(symbol: Symbol, md5: string) {
    const infos = this.symbolInfos.get(symbol);
    if (infos) {
      this.symbolInfos.set(symbol, {
        ...infos,
        md5,
      });
    }
  }
  getFullPath(symbol: Symbol): FilePath | undefined {
    const relativePath = this.getRelativePath(symbol);
    if (!relativePath) {
      return undefined;
    }
    return join(dirname(this.filePath), this.scryptBasePath, relativePath);
  }

  getPackageFilePath(packageName: string,symbol: Symbol): FilePath | undefined {
    const relativePath = this.getRelativePath(symbol);
    if (!relativePath) {
      return undefined;
    }
    return path.join(`${packageName}/${this.scryptBasePath}`, `${relativePath}`);
  }

  static queryIndexFile(fromPath: FilePath, toPath?: FilePath): FilePath | undefined {
    let searchDir = fromPath;
    toPath = toPath === undefined ? process.cwd() : toPath;
    const isSamePath = (pathA: string, pathB: string) => {
      return resolve(pathA).toLowerCase() == resolve(pathB).toLowerCase();
    };
    while (true) {
      const indexFile = join(searchDir, INDEX_FILE_NAME);
      if (existsSync(indexFile)) {
        return indexFile;
      }
      const parentDir = join(searchDir, '..');
      if (isSamePath(searchDir, toPath) || isSamePath(searchDir, parentDir)) {
        break;
      }
      searchDir = parentDir;
    }

    const indexFile = join(toPath, INDEX_FILE_NAME);
    if (existsSync(indexFile)) {
      return indexFile;
    }

    return undefined;
  }

  query(symbol: Symbol, includeBase = false): FilePath | undefined {
    const sInfo = this.symbolInfos.get(symbol);
    return sInfo && includeBase ? join(this.scryptBasePath, sInfo.path) : sInfo.path;
  }

  save(): this {
    const content = {
      scryptBase: toPosixPath(this.scryptBasePath),
      bindings: Array.from(this.symbolInfos.keys()).map((symbol) => {
        const infos = this.symbolInfos.get(symbol);
        return { symbol, ...filterUndefinedFields(infos) };
      }),
    };
    writeFileSync(this.filePath, JSON.stringify(content, null, 1));
    return this;
  }

  addSymbols(
    symbolsWithRange: { name: Symbol; srcRange: Range; stateType?: Symbol }[],
    symbolPath: FilePath,
  ) {
    symbolsWithRange.forEach((symbolWithRange) => {
      const infos = this.symbolInfos.get(symbolWithRange.name);
      if (infos && infos.path !== symbolPath) {
        const srcFileName = symbolWithRange.srcRange.fileName;
        const startLine = symbolWithRange.srcRange.start.line + 1;
        const startCol = symbolWithRange.srcRange.start.character + 1;
        const endLine = symbolWithRange.srcRange.end.line + 1;
        const endCol = symbolWithRange.srcRange.end.character + 1;
        console.log(
          `scrypt-ts ERROR - ${srcFileName}:${startLine}:${startCol}:${endLine}:${endCol} - symbol \`${
            symbolWithRange.name
          }\` already has been defined in \`${infos.path!.replace(
            '.scrypt',
            '.ts',
          )}\` in ${this.filePath}\n`,
        );
      } else {
        this.symbolInfos.set(symbolWithRange.name, {
          ...infos,
          stateType: symbolWithRange.stateType,
          path: symbolPath,
        });
      }
    });
    this.save();
  }

  static create(tsconfigDir: string, scryptOutDir: string): Indexer {
    const filePath = join(tsconfigDir, INDEX_FILE_NAME);
    const scryptBasePath = relative(tsconfigDir, scryptOutDir);
    const indexer = new Indexer(filePath);
    indexer.setScryptBasePath(scryptBasePath);
    indexer.clean();
    return indexer.save();
  }
}

export function readArtifact(cls: typeof SmartContract): Artifact {
  // find scrypt file path in the indexer
  const indexer = new Indexer();
  const scryptFile = indexer.getFullPath(cls.name as Symbol);

  if (!scryptFile) {
    throw new Error(
      `Cannot find the bundled artifact file for contract \`${this.name}\`, run \`npx scrypt-cli-btc compile\` to generate it.`,
    );
  }

  const artifactFile = alterFileExt(scryptFile, 'json');

  if (!existsSync(scryptFile)) {
    throw new Error(
      `Cannot find the bundled artifact file for contract \`${this.name}\`, run \`npx scrypt-cli-btc compile\` to generate it.`,
    );
  }

  return JSON.parse(readFileSync(artifactFile).toString());
}
