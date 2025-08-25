import * as fs from 'fs';
import path from 'path';
import { exit } from 'process';
import { green, red } from 'chalk';
import {
  stepCmd,
  readdirRecursive,
  writefile,
  readfile,
  shExec,
  resolvePaths,
  extractBaseNames,
  readAsset,
} from '../common/utils';
import ts from 'typescript';
import {
  safeCompilerVersion,
  getBinary,
  compileContract,
  findCompiler,
} from '@opcat-labs/scrypt-ts-transpiler';

import { cloneDeep } from '@opcat-labs/scrypt-ts';

export interface CompileCommandOptions {
  include?: string;
  exclude?: string;
  tsconfig?: string;
  watch?: boolean;
  noArtifact?: boolean;
  asm?: boolean;
}

function containsDeprecatedOptions(options: ts.CompilerOptions): boolean {
  return (
    'out' in options ||
    'noImplicitUseStrict' in options ||
    'keyofStringsOnly' in options ||
    'suppressExcessPropertyErrors' in options ||
    'suppressImplicitAnyIndexErrors' in options ||
    'noStrictGenericChecks' in options ||
    'charset' in options ||
    'importsNotUsedAsValues' in options ||
    'preserveValueImports' in options
  );
}

export async function compile({
  include,
  exclude,
  tsconfig,
  watch,
  noArtifact,
  asm,
}: CompileCommandOptions): Promise<void> {
  const scryptcPath = findCompiler();
  if (!scryptcPath || safeCompilerVersion(scryptcPath) === '0.0.0') {
    // no scryptc found, auto download scryptc
    await getBinary();
  }

  const tsconfigScryptTSPath = path.resolve(tsconfig ? tsconfig : 'tsconfig-scryptTS.json');
  const tsconfigPath = path.resolve('tsconfig.json');

  if (!fs.existsSync(tsconfigScryptTSPath)) {
    if (!fs.existsSync(tsconfigPath)) {
      writefile(tsconfigScryptTSPath, readAsset('tsconfig.json'));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, <any>ts.sys);

      if (!parsedCommandLine) {
        console.log(red(`ERROR: invalid tsconfig.json`));
        exit(-1);
      }

      if (parsedCommandLine.errors[0]) {
        console.log(red(`ERROR: invalid tsconfig.json`));
        exit(-1);
      }

      const override = containsDeprecatedOptions(parsedCommandLine.options)
        ? {
            noEmit: true,
            experimentalDecorators: true,
            target: 'ESNext',
            esModuleInterop: true,
            ignoreDeprecations: '5.0',
          }
        : {
            noEmit: true,
            experimentalDecorators: true,
            target: 'ESNext',
            esModuleInterop: true,
          };

      writefile(tsconfigScryptTSPath, {
        extends: './tsconfig.json',
        include: ['src/contracts/**/*.ts'],
        compilerOptions: override,
      });
    }
  }

  // Check TS config
  const outDir = 'artifacts';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = readfile<any>(tsconfigScryptTSPath, true);

  if (include) {
    config.include = include.split(',');
  }

  if (exclude) {
    config.exclude = exclude.split(',');
  }

  let clonedConfig = cloneDeep(config);

  Object.assign(config.compilerOptions, {
    plugins: [],
  });

  config.compilerOptions.plugins.push({
    transform: require.resolve('@opcat-labs/scrypt-ts-transpiler'),
    transformProgram: true,
    outDir,
  });

  writefile(tsconfigScryptTSPath, JSON.stringify(config, null, 2));

  process.on('exit', () => {
    if (clonedConfig !== null) {
      writefile(tsconfigScryptTSPath, JSON.stringify(clonedConfig, null, 2));
      clonedConfig = null;
    }
  });

  process.on('SIGINT', function () {
    if (clonedConfig !== null) {
      writefile(tsconfigScryptTSPath, JSON.stringify(clonedConfig, null, 2));
      clonedConfig = null;
    }
    process.exit();
  });

  let ts_patch_path = require.resolve('typescript').split(path.sep);
  ts_patch_path = ts_patch_path.slice(0, ts_patch_path.length - 2);
  ts_patch_path.push('bin');
  ts_patch_path.push('tsc');

  const tsc = ts_patch_path.join(path.sep);

  // Run tsc which in turn also transpiles to sCrypt
  if (watch) {
    await shExec(`node "${tsc}" --watch --p "${tsconfigScryptTSPath}"`);
  } else {
    const result = await stepCmd(
      'Building TS',
      `node "${tsc}" --p "${tsconfigScryptTSPath}"`,
      false,
    );

    if (result instanceof Error) {
      console.log(red(`ERROR: Building TS failed!`));
      console.log(
        `Please modify your code or \`tsconfig-scryptTS.json\` according to the error message output during BUILDING.`,
      );
      try {
        writefile(tsconfigScryptTSPath, JSON.stringify(clonedConfig, null, 2));
        clonedConfig = null;
      } catch (error) {
        console.log(red(`ERROR: save \`tsconfig-scryptTS.json\` failed!`), error);
        exit(-1);
      }
    }
  }
  try {
    writefile(tsconfigScryptTSPath, JSON.stringify(clonedConfig, null, 2));
    clonedConfig = null;
  } catch (error) {
    console.log(red(`ERROR: save \`tsconfig-scryptTS.json\` failed!`), error);
    exit(-1);
  }

  if (!fs.existsSync(outDir)) {
    console.log(red(`ERROR: outDir '${outDir}' not exists`));
    exit(-1);
  }

  if (asm) {
    if (!fs.existsSync('.asm/apply_asm.cjs')) {
      console.log(red(`ERROR: no ".asm/apply_asm.cjs" found`));
      process.exit(-1);
    }

    await stepCmd('Applying ASM optimizations', `node .asm/apply_asm.cjs`);
  }

  let successCount = 0;
  let failedCount = 0;

  if (!noArtifact) {
    // Compile only what was transpiled using TSC
    const include = extractBaseNames(
      resolvePaths(Array.isArray(config.include) ? config.include : []),
    );
    const exclude = extractBaseNames(
      resolvePaths(Array.isArray(config.exclude) ? config.exclude : []),
    );
    const toCompile = include.filter((el) => !exclude.includes(el));

    const files: string[] = [];
    const distFiles = await readdirRecursive(outDir);
    for (const f of distFiles) {
      const relativePath = path.relative(outDir, f);
      if (!relativePath.startsWith('.templates' + path.sep)) {
        // Ignore transformer files not in templates directory
        continue;
      }

      const fAbs = path.resolve(f);

      if (fAbs.endsWith('.transformer.json')) {
        try {
          const name = path.basename(fAbs, '.transformer.json');

          if (!toCompile.includes(name)) {
            // Ignore files not included
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transformerResult: any = readfile(fAbs, true);
          const { scryptfile, success } = transformerResult;
          // find the corresponding scrypt file in the outDir for the transformer file in the templates directory
          const scrTemplateFilePath = path.resolve(
            outDir,
            path.relative(
              path.join(outDir, '.templates'),
              path.join(path.dirname(fAbs), path.basename(scryptfile, '.tpl')),
            ),
          );

          if (success) {
            if (fs.existsSync(scrTemplateFilePath)) {
              files.push(scrTemplateFilePath);
            } else {
              failedCount++;
              const resStr = `\nTranslation succeeded but scrypt file not found! ${fAbs}\n`;
              console.log(red(resStr));
            }
          } else if (success === false) {
            failedCount++;
            const resStr = `\nTranslation failed! See errors in: ${fAbs}\n`;
            console.log(red(resStr));
          }
        } catch (error) {
          failedCount++;
          console.log(red(`ERROR: ${error.message}, transformer file: ${fAbs}`));
        }
      }
    }

    for (const f of files) {
      try {
        const outDir = path.dirname(f);
        const result = compileContract(f, {
          out: outDir,
          artifact: true,
          optimize: true,
        });

        if (result.errors.length > 0) {
          failedCount++;
          console.log(red(`Failed to compile ${f}, ERROR: ${result.errors[0].message}`));
          continue;
        }

        successCount++;

        const artifactPath = path.join(outDir, `${path.basename(f, '.scrypt')}.json`);

        console.log(green(`Compiled successfully, artifact file: ${artifactPath}`));
      } catch (e) {
        const resStr = `\nCompilation failed.\n`;
        console.log(red(resStr));
        console.log(red(`ERROR: ${e.message}`));
        exit(-1);
      }
    }
  }

  const resStr = `\nProject compilation completed!`;
  console.log(green(resStr));

  console.log(green(`\n${successCount} passing`));

  console.log(red(`\n${failedCount} failing`));

  exit(0);
}
