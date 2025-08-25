import path from 'path';
import fs from 'fs';
import { resolvePathSync } from 'mlly';
import { ImportExpression, ExportSymbol, ScryptFileParser } from './scryptParser';
import { arrayIncludes, removeDuplicateFilter } from './utils';

export const TEMPLATE_FOLDER_NAME = '.templates';
export const TPL_FILE_EXTENSION = '.tpl';
export const RENAME_SYMBOL_SEP = '__rs__';

type ScryptFile = {
  importExpressions: ImportExpression[];
  exportSymbols: ExportSymbol[];
  // original absolute path of the .scrypt.tpl file
  originFilePath: string;
  // relinked absolute path of the .scrypt file
  relinkedFilePath: string;
  // package name
  packageName: string;
  // package version
  packageVersion: string;
};

type ScryptFileMap = Map<string, ScryptFile>;

export class Relinker {
  public fileMap: ScryptFileMap;

  constructor(
    public readonly projectRoot: string,
    public readonly scryptBasePath: string,
  ) {
    this.fileMap = new Map();
  }

  static getUnRenamedSymbol(symbol: string): string {
    const parts = symbol.split(RENAME_SYMBOL_SEP);
    if (parts.length === 1) {
      return parts[0];
    }
    return parts[parts.length - 1];
  }
  static getRenamedSymbol(symbol: string, packageName: string, packageVersion: string) {
    return Utils.getRenamedSymbol(symbol, {
      packageName,
      packageVersion,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  /// get the package info by a file in that package
  static getFilePackageInfo(filePath: string) {
    return Utils.getFilePackageInfo(filePath);
  }

  get currentProjectArtifactDir() {
    return path.resolve(this.projectRoot, this.scryptBasePath, '..');
  }

  relink(currentScryptFilePath: string) {
    const relinkedFilePath = this.getRelinkedFilePath(currentScryptFilePath);
    console.log(`relink ${currentScryptFilePath} to ${relinkedFilePath}`);
    // parse import expressions in the .scrypt.tpl file;
    const fileContent = fs.readFileSync(currentScryptFilePath, 'utf-8');
    const { importExpressions, exportSymbols, usedSymbols } =
      ScryptFileParser.parseScryptFile(fileContent);

    // relink the dependencies first;
    if (importExpressions.length > 0) {
      this.relinkDeps(currentScryptFilePath, importExpressions);
    }

    // generate a new .scrypt file content;
    let relinkedFileContent = '';

    // replace import paths;
    importExpressions.sort((a, b) => a.index - b.index);
    let lastIndex = 0;
    for (const importExpression of importExpressions) {
      const newImportPath = importExpression.importPath;
      const absolutePath = Utils.toAbsolutePath(newImportPath, currentScryptFilePath);
      const dep = this.fileMap.get(absolutePath);
      if (!dep) {
        throw new Error(`Dependency ${absolutePath} not found`);
      }
      relinkedFileContent += fileContent.slice(lastIndex, importExpression.index);

      const rewritePath = Utils.convertToPosixPath(
        path.relative(path.dirname(relinkedFilePath), dep.relinkedFilePath),
      );
      relinkedFileContent += importExpression.expression.replace(
        importExpression.importPath,
        rewritePath,
      );
      lastIndex = importExpression.index + importExpression.expression.length;
    }
    relinkedFileContent += '\n\n';

    // rename symbols
    let renamedSymbols = [
      ...exportSymbols,
      ...usedSymbols.exportedSymbols,
      ...usedSymbols.importedSymbols,
    ];
    renamedSymbols.sort((a, b) => a.index - b.index);
    renamedSymbols = renamedSymbols.filter(removeDuplicateFilter((a, b) => a.index === b.index));

    const packageInfo = Utils.getFilePackageInfo(currentScryptFilePath);
    const currentParsedFile: ScryptFile = {
      importExpressions,
      exportSymbols,
      originFilePath: currentScryptFilePath,
      relinkedFilePath: this.getRelinkedFilePath(currentScryptFilePath),
      packageName: packageInfo.packageName,
      packageVersion: packageInfo.packageVersion,
    };
    for (const symbol of renamedSymbols) {
      if (arrayIncludes(exportSymbols, symbol, (a, b) => a.value === b.value)) {
        // rename exported symbol
        relinkedFileContent += fileContent.slice(lastIndex, symbol.index);

        const renamedSymbol = Utils.getRenamedSymbol(symbol.value, currentParsedFile);
        relinkedFileContent += renamedSymbol;
        lastIndex = symbol.index + symbol.value.length;
      } else {
        // rename imported symbol
        relinkedFileContent += fileContent.slice(lastIndex, symbol.index);

        const sourceFile = this.findImportedSymobleSource(
          symbol.value,
          currentScryptFilePath,
          currentParsedFile.importExpressions,
        );
        if (!sourceFile) {
          throw new Error(`Imported symbol ${symbol.value} not found in all imported files`);
        }

        const renamedSymbol = Utils.getRenamedSymbol(symbol.value, sourceFile);
        relinkedFileContent += renamedSymbol;
        lastIndex = symbol.index + symbol.value.length;
      }
    }
    relinkedFileContent += fileContent.slice(lastIndex);

    // write to the artifacts directory;
    Utils.writeFile(relinkedFilePath, relinkedFileContent);
    this.fileMap.set(currentScryptFilePath, {
      importExpressions,
      exportSymbols,
      originFilePath: currentScryptFilePath,
      relinkedFilePath,
      packageName: packageInfo.packageName,
      packageVersion: packageInfo.packageVersion,
    });
  }

  relinkDeps(parentFile: string, importExpressions: ImportExpression[]) {
    // for each import expression, do relink;
    for (const importExpression of importExpressions) {
      const importPath = importExpression.importPath;
      const absolutePath = Utils.toAbsolutePath(importPath, parentFile);
      if (this.fileMap.has(absolutePath)) {
        continue;
      }
      this.relink(absolutePath);
    }
  }

  findImportedSymobleSource(
    symbol: string,
    currentScryptFilePath: string,
    importExpressions: ImportExpression[],
  ) {
    for (const importExpression of importExpressions) {
      const absolutePath = Utils.toAbsolutePath(importExpression.importPath, currentScryptFilePath);
      const dep = this.fileMap.get(absolutePath);
      if (!dep) {
        throw new Error(`Dependency ${absolutePath} not found`);
      }
      if (arrayIncludes(dep.exportSymbols, symbol, (a, b) => a.value === b)) {
        return dep;
      }
    }
    return null;
  }

  /**
   * get the relinked file path by the absolute scrypt.tpl file path;
   * @param absoluteScryptFilePath absolute scrypt.tpl file path
   * @returns relinked file path
   */
  getRelinkedFilePath(absoluteScryptFilePath: string) {
    // file struct:
    const currentProjectTemplateDir = path.resolve(this.projectRoot, this.scryptBasePath);
    const currentProjectArtifactDir = path.resolve(this.projectRoot, this.scryptBasePath, '..');

    // file is under the current project template directory, the relinked file is under the current project artifacts directory;
    if (absoluteScryptFilePath.startsWith(currentProjectTemplateDir)) {
      return path.resolve(
        currentProjectArtifactDir,
        path.relative(currentProjectTemplateDir, this.removeTplExt(absoluteScryptFilePath)),
      );
    }

    // file is under node_modules, the relinked file is under the currentProject/artifacts/.node_modules/packageName/.../relinkedFile;
    // use `.node_modules` instead of `node_modules` to avoid module resolution error;
    let relativePath = path.relative(this.projectRoot, absoluteScryptFilePath);
    relativePath = Utils.removeLeadingDot(Utils.removeFolder(relativePath, TEMPLATE_FOLDER_NAME));
    relativePath = this.removeTplExt(relativePath);
    relativePath = relativePath.replace('node_modules', '.node_modules');

    return path.resolve(this.projectRoot, this.currentProjectArtifactDir, relativePath);
  }

  /**
   * remove the .tpl extension from the file path;
   * @param filePath file path
   * @returns
   */
  removeTplExt(filePath: string) {
    if (filePath.endsWith(TPL_FILE_EXTENSION)) {
      return filePath.substring(0, filePath.length - TPL_FILE_EXTENSION.length);
    }
    return filePath;
  }
}

class Utils {
  /**
   * get the package info from the absolute file path;
   * search the package.json file in the current directory and its parent directories;
   * @param absoluteFilePath
   * @returns
   */
  static getFilePackageInfo(absoluteFilePath: string) {
    let dir = path.resolve(absoluteFilePath, '..');
    while (true) {
      if (fs.existsSync(path.resolve(dir, './package.json'))) {
        const packageJsonPath = path.resolve(dir, './package.json');
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          return {
            packageDir: dir,
            packageName: packageJson.name as string,
            packageVersion: packageJson.version as string,
          };
        } catch (error) {
          console.error(`Failed to parse package.json in ${packageJsonPath}:`);
          throw error;
        }
      }
      const parentDir = path.resolve(dir, '..');
      if (parentDir === dir) {
        throw new Error(`Package info not found for ${absoluteFilePath}`);
      }
      dir = parentDir;
    }
  }

  /**
   * get the renamed symbol;
   * @param symbol original symbol
   * @param parsedFile parsed file
   * @returns renamed symbol
   */
  static getRenamedSymbol(symbol: string, parsedFile: ScryptFile) {
    return `${parsedFile.packageName.replace(/\W/g, '_')}_${parsedFile.packageVersion.replace(/\W/g, '_')}${RENAME_SYMBOL_SEP}${symbol}`;
  }

  /**
   * convert the import relative path to the absolute path;
   * @param importPath
   * @param baseFileAbsolutePath
   * @returns
   */
  static toAbsolutePath(importPath: string, baseFileAbsolutePath: string) {
    // relative path
    if (importPath.startsWith('.')) {
      return path.resolve(baseFileAbsolutePath, '..', importPath);
    }
    // npm package
    const { pkgName, file } = this.parseNpmPkgFile(importPath);
    const pkgRoot = this.findPackageRoot(pkgName, baseFileAbsolutePath);
    return path.resolve(pkgRoot, file);
  }

  /**
   * find the package root by the package name and the parent file that contains the import expression;
   * @param pkgName package name
   * @param baseFilePath parent file that contains the import expression
   * @returns package root, that contains the package.json file
   */
  static findPackageRoot(pkgName: string, baseFilePath: string) {
    let mainFile: string;
    try {
      mainFile = resolvePathSync(pkgName, { url: baseFilePath });
    } catch (error) {
      error.message = `findPackageRoot failed: ` + error.message;
      throw error;
    }
    let dir = path.dirname(mainFile);
    while (true) {
      if (fs.existsSync(path.resolve(dir, 'package.json'))) {
        return dir;
      }
      const parentDir = path.resolve(dir, '..');
      if (parentDir === dir) {
        throw new Error(`Package root not found for ${pkgName}`);
      }
      dir = parentDir;
    }
  }

  /**
   * parse the npm package file path by a import path;
   * @param filePath import path
   * @returns package name and the rest relative file path
   */
  static parseNpmPkgFile(filePath: string) {
    const parts = filePath.split('/');
    let pkgName = parts[0];
    if (pkgName.startsWith('@')) {
      pkgName = pkgName + '/' + parts[1];
    }

    let file = filePath.substring(pkgName.length);
    if (file.startsWith('/')) {
      file = '.' + file;
    }

    return {
      pkgName,
      file,
    };
  }

  /**
   * write the content to the file; create the directory if not exists;
   * @param filePath
   * @param content
   */
  static writeFile(filePath: string, content: string) {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }

  /**
   * remove the leading dot from the relative file path;
   * for example: ../../node_modules/xxx/yyy.zz -> node_modules/xxx/yyy.zz
   * @param relativeFilePath relative file path
   * @returns
   */
  static removeLeadingDot(relativeFilePath: string) {
    const normalized = path.normalize(relativeFilePath);
    const parts = normalized.split(path.sep).filter((part) => part != '..');
    return path.join(...parts);
  }

  /**
   * remove the folder from the file path;
   *
   * for example: (filePath = node_modules/xxx/yyy.zz, folderName = xxx) -> node_modules/yyy.zz
   *
   * @param filePath file path
   * @param folderName folder name
   * @returns
   */
  static removeFolder(filePath: string, folderName: string) {
    const normalized = path.normalize(filePath);
    const parts = normalized.split(path.sep).filter((part) => part !== folderName);
    return path.join(...parts);
  }

  /**
   * convert the file path to the posix path;
   * for example: xxx\yyy.zz -> xxx/yyy.zz
   * @param filePath file path
   * @returns
   */
  static convertToPosixPath(filePath: string) {
    return filePath.replaceAll(path.sep, path.posix.sep);
  }
}
