import fetch from 'node-fetch';
import { arch, platform } from 'os';
import { join, dirname } from 'path';
import { chmodSync, createWriteStream, existsSync, mkdirSync } from 'fs';

import { compilerVersion } from './compilerWrapper';
import { getPlatformScryptc } from './findCompiler';
import { getProxySettings } from 'get-proxy-settings';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chalk from 'chalk';
import { promisify } from 'util';
import { pipeline } from 'stream';

const DEFAULT_COMPILER_VERSION = '1.21.0';

export function safeCompilerVersion(cmd) {
  try {
    return compilerVersion(cmd);
  } catch (_) {
    return '0.0.0';
  }
}

export const getBinary = async (version?: string) => {
  const architecture = arch();
  let FILENAME = 'Windows-AMD64.exe';

  version = version || DEFAULT_COMPILER_VERSION;

  const proxy = await getProxySettings();

  if (version === 'latest') {
    const fromAPI = await fetch(
      'https://api.github.com/repos/scrypt-inc/compiler_dist/releases',
      proxy !== null && proxy.https ? { agent: new HttpsProxyAgent(proxy.https.toString()) } : {},
    );
    const res = await fromAPI.json();

    if (res && res[0] && res[0].tag_name) {
      version = res[0].tag_name.substring(1);
    } else {
      console.info(
        `${chalk.green.bold(`
${chalk.grey.bold('x')}`)}`,
        `fetch latest sCrypt compiler version failed, using default version: ${DEFAULT_COMPILER_VERSION}`,
      );
      version = DEFAULT_COMPILER_VERSION;
    }
  }

  if (platform() === 'linux') {
    if (architecture == 'arm64') {
      FILENAME = 'Linux-aarch64';
    } else {
      FILENAME = 'Linux-x86_64';
    }
  } else if (platform() === 'darwin') {
    FILENAME = 'macOS-x86_64';
  }

  const streamPipeline = promisify(pipeline);
  const urlCompiler = `https://github.com/sCrypt-Inc/compiler_dist/releases/download/v${version}/scryptc-${version}-${FILENAME}`;
  const filePathCompiler = join(__dirname, getPlatformScryptc());
  const dirCompiler = dirname(filePathCompiler);

  if (!existsSync(dirCompiler)) {
    mkdirSync(dirCompiler, { recursive: true });
  }

  console.info(
    `${chalk.yellow.bold(
      `
${chalk.grey('•')}`,
      `Downloading sCrypt compiler: ${version} ...`,
    )}`,
  );

  try {
    const fromRelease = await fetch(
      urlCompiler,
      proxy !== null && proxy.https
        ? {
            agent: new HttpsProxyAgent(proxy.https.toString()),
          }
        : {},
    );

    if (!fromRelease.ok || !fromRelease.body) {
      showDownloadFailed();
      return;
    } else {
      await streamPipeline(fromRelease.body, createWriteStream(filePathCompiler));
      chmodSync(filePathCompiler, '755');
      console.info(
        `${chalk.green.bold(`
${chalk.green('✔')}`)}`,
        chalk.green.bold(`Successfully downloaded. File Path: ${filePathCompiler}`),
      );
    }
  } catch (_) {
    showDownloadFailed();
  }
};

function showDownloadFailed() {
  console.info(`${chalk.bgRed.bold('**ERROR**: Downloading sCrypt compiler failed.')}`);
  console.info(
    `Go to ${chalk.blue.bold(
      'https://github.com/sCrypt-Inc/compiler_dist/releases',
    )} to download sCrypt compiler.\n`,
  );
}

if (require.main === module) {
  getBinary();
}
