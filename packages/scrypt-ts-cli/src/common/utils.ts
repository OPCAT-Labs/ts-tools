import ora from 'ora';
import util from 'util';
import sh from 'shelljs';
import fs from 'fs';
import { glob, GlobOptions } from 'glob';
import { green, red, yellow } from 'chalk';
import { readdir } from 'fs/promises';
import { join, basename, dirname, extname, sep } from 'path';
import { exit } from 'process';
import hjson from 'hjson';
import * as tar from 'tar';

export const shExec = util.promisify(sh.exec);

export function shExecWithoutOutput(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sh.exec(command, { silent: true }, (code, stdout, stderr) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function readdirRecursive(dir: string): Promise<string[]> {
  const files = await readdir(dir, { withFileTypes: true });

  const paths = files.map(async (file) => {
    const p = join(dir, file.name);

    if (file.isDirectory()) return await readdirRecursive(p);

    return p;
  });

  return (await Promise.all(paths)).flat(1);
}

/**
 * Helper for any steps for a consistent UX.
 * @template T
 * @param {string} step  Name of step to show user.
 * @param {() => Promise<T>} fn  An async function to execute.
 * @returns {Promise<T>}
 */
export async function step<T>(str: string, fn: () => Promise<T>): Promise<T> {
  const spin = ora({ text: `${str}...`, discardStdin: true }).start();
  try {
    const result = await fn();
    spin.succeed(green(str));
    return result;
  } catch (err) {
    spin.fail(str);
    console.error('  ' + red(err)); // maintain expected indentation
    exit(-1);
  }
}

/**
 * Helper for any steps that need to call a shell command.
 * @param {string} step - Name of step to show user
 * @param {string} cmd - Shell command to execute.
 * @returns {Promise<string>}
 */
export async function stepCmd(
  step: string,
  cmd: string,
  exitOnError: boolean = true,
): Promise<string | Error> {
  const spin = ora({ text: `${step}...\n`, discardStdin: true }).start();
  try {
    const result = await shExec(cmd);
    spin.succeed(green(step));
    return result;
  } catch (err) {
    console.log('  ' + red(err.stack));
    spin.fail(step);
    if (exitOnError) {
      exit(-1);
    }

    return err;
  }
}

/**
 * Helper to replace text in a file.
 * @param {string} file - Path to file
 * @param {string} a - Old text.
 * @param {string} b - New text.
 */
export function replaceInFile(file: string, a: string, b: string): void {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replaceAll(a, b);
  fs.writeFileSync(file, content);
}

/**
 * Helper to read a JSON file
 * @param {string} file
 * @param {boolean} if returns json format
 * @returns
 */
export function readfile<T>(file: string, json: boolean = true): T | string {
  const content = fs.readFileSync(file, 'utf8');
  if (json) {
    return hjson.parse(content) as T;
  }
  return content;
}

/**
 * Helper to write a JSON object to a file
 * @param {string} path - Path of file
 * @param {object | string} content - Object or text to save
 */
export function writefile(file: string, content: object | string): void {
  if (typeof content === 'string') {
    fs.writeFileSync(file, content);
  } else {
    fs.writeFileSync(file, JSON.stringify(content, null, 2));
  }
}

/**
 * Helper function to delete a file or directory.
 * @param {string} itemPath Path to the file or directory to delete.
 */
export function deletefile(itemPath: string): void {
  try {
    // Check if the item is a directory or file
    if (fs.statSync(itemPath).isDirectory()) {
      fs.rmdirSync(itemPath, { recursive: true });
    } else {
      fs.unlinkSync(itemPath);
    }
  } catch (error) {
    // If the error is about the item not existing, just continue
    // For other errors, throw the error for further handling
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Helper to change file extension in a path
 * @param {string} file - The path of a file
 * @param {string} extension
 * @returns {string}
 */
export function changeExtension(file: string, extension: string): string {
  const name = basename(file, extname(file));
  return join(dirname(file), name + '.' + extension);
}

/**
 * Read config in src/configs
 * @param {string} config Filename
 * @returns
 */
export function readAsset(filename: string): string {
  return readfile(join(dirname(__filename), '..', '..', 'assets', filename), false) as string;
}

export function writeAsset(absolutePath: string, assetFileName?: string): void {
  const fileName = absolutePath.substring(absolutePath.lastIndexOf(sep) + 1);
  const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
  if (fs.existsSync(absolutePath)) {
    console.log(yellow(`Found ${fileName}, move to ${fileName}.backup`));
    fs.renameSync(absolutePath, changeExtension(absolutePath, `${fileExtension}.backup`));
  }
  writefile(absolutePath, readAsset(assetFileName || fileName));
}

export function isProjectRoot(): boolean {
  return fs.existsSync('package.json') && fs.existsSync('tsconfig.json');
}

export function titleCase(str: string): string {
  return str
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase())
    .join(' ')
    .replace('Scrypt', 'sCrypt');
}

export function kebabCase(str: string): string {
  return str.toLowerCase().replace(' ', '-');
}

export function camelCase(str: string): string {
  const a = str.toLowerCase().replace(/[-_\s.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  return a.substring(0, 1).toLowerCase() + a.substring(1);
}

export function camelCaseCapitalized(str: string): string {
  const a = camelCase(str);
  return a.substring(0, 1).toUpperCase() + a.substring(1);
}

export function resolvePaths(patterns: string[], options: GlobOptions = {}): string[] {
  try {
    let res: string[] = [];
    for (const pattern of patterns) {
      const files = glob.globSync(pattern.replaceAll(sep, '/'), options) as string[];
      res = res.concat(files);
    }
    return res;
  } catch (err) {
    throw new Error(`Error resolving paths: ${err.message}`);
  }
}

export function extractBaseNames(input: string[]): string[] {
  return input.map((filePath) => basename(filePath, extname(filePath)));
}

export async function createAsmDir() {
  const step = 'Creating .asm dir ';
  const asmDir = join('.', '.asm');
  await stepCmd(step, `mkdir ${asmDir} && echo {} > ${asmDir}/asm.json`);
  writefile(join(asmDir, 'apply_asm.cjs'), readAsset('apply_asm.cjs'));
}

export async function unTarTemplates(projectName: string, outDir: string) {
  const tarPath = join(
    dirname(__filename),
    '..',
    '..',
    'assets',
    'templates',
    `${projectName}.tar.gz`,
  );
  return tar.x({
    file: tarPath,
    C: outDir,
    strip: 1,
  });
}
