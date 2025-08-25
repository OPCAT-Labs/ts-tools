import { existsSync, readFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { Indexer, Symbol, compileContract } from '@opcat-labs/scrypt-ts-transpiler';
import { alterFileExt } from '@opcat-labs/scrypt-ts-transpiler/dist/utils';
import { SmartContract, SmartContractLib, Artifact } from '@opcat-labs/scrypt-ts';
import path from 'path';

export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}
export function loadTransformerResult(
  smartContract: typeof SmartContract<any> | typeof SmartContractLib,
): {
  success: boolean;
  errors: string[];
  ctxMethods: string[];
} {
  // find indexer file of the contract
  const cwd = process.cwd();
  const indexFile = join(cwd, 'scrypt.index.json');
  if (!existsSync(indexFile)) {
    throw new Error(
      `Cannot find \`scrypt.index.json\` file, run \`yarn run buildtest\` to generate it.`,
    );
  }

  // find scrypt file path in the indexer
  const indexer = new Indexer(indexFile);
  const scryptFilePath = indexer.getFullPath(smartContract.name as Symbol);
  if (!scryptFilePath || !existsSync(scryptFilePath)) {
    throw new Error(
      `Cannot find the bundled scrypt file for contract \`${this.name}\`, run \`yarn run buildtest\` to generate it.`,
    );
  }

  const filePath = alterFileExt(scryptFilePath, 'transformer.json', 'scrypt.tpl');

  return JSON.parse(readFileSync(filePath).toString());
}

/// use it internally
export function loadArtifact(smartContract: typeof SmartContract<unknown>): Artifact | undefined {
  // find indexer file of the contract
  const cwd = process.cwd();
  const indexFile = join(cwd, 'scrypt.index.json');
  if (!existsSync(indexFile)) {
    throw new Error(
      `Cannot find \`scrypt.index.json\` file, run \`npx scrypt-cli-btc compile\` to generate it.`,
    );
  }

  // find scrypt file path in the indexer
  const indexer = new Indexer(indexFile);
  const tplFilePath = indexer.getFullPath(smartContract.name as Symbol);
  if (!tplFilePath) {
    throw new Error(`Cannot find the bundled scrypt file for contract \`${smartContract.name}\`, run \`npx scrypt-cli-btc compile\` to generate it.`);
  }

  const templateDir = path.join(dirname(indexer.filePath), indexer.scryptBasePath);
  let scryptFilePath = path.join(
    templateDir,
    '..',
    path.relative(templateDir, tplFilePath)
  )
  scryptFilePath = alterFileExt(
    scryptFilePath,
    'scrypt',
    'scrypt.tpl'
  );

  if (!scryptFilePath || !existsSync(scryptFilePath)) {
    throw new Error(
      `Cannot find the bundled scrypt file for contract \`${this.name}\`, run \`npx scrypt-cli-btc compile\` to generate it.`,
    );
  }

  return compileContract(scryptFilePath, { artifact: true, optimize: true }).toArtifact();
}

export function loadASM(fileName: string): string {
  return readFileSync(
    join(__dirname, 'fixtures', fileName.replace('.scrypt', '_asm.json')),
  ).toString();
}

export function getContractFilePath(fileName: string): string {
  return join(__dirname, '..', 'fixtures', fileName);
}

export function getInvalidContractFilePath(fileName: string): string {
  return join(__dirname, 'fixtures', 'invalid', fileName);
}
export function excludeMembers(o: object, members: string[]) {
  if (Array.isArray(o)) {
    return o.map((i) => excludeMembers(i, members));
  } else {
    Object.keys(o).forEach((key) => {
      if (members.indexOf(key) > -1) {
        delete o[key];
      }

      if (typeof o[key] === 'object' && o[key] !== null) {
        excludeMembers(o[key], members);
      }
    });
  }

  return o;
}
