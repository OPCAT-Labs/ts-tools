import ora from 'ora';
import { exit } from 'process';
import { existsSync, readFileSync } from 'fs';
import * as sh from 'shelljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../../package.json');

import {
  camelCase,
  camelCaseCapitalized,
  createAsmDir,
  kebabCase,
  replaceInFile,
  stepCmd,
  titleCase,
  unTarTemplates,
  writefile,
} from '../common/utils';
import { join, sep } from 'path';
import { red, green } from 'chalk';

export interface ProjectCommandOptions {
  state?: boolean;
  lib?: boolean;
  asm?: boolean;
}

export enum ProjectType {
  Contract,
  Library,
  StatefulContract,
}

export const PROJECT_NAME_TEMPLATE = 'PROJECT_NAME';
export const PROJECT_FILENAME_TEMPLATE = 'PROJECT_FILENAME';

export const PROJECT_PACKAGE_NAME_TEMPLATE = 'package-name';

/**
 * Create a new sCrypt project with recommended dir structure, Prettier config,
 * testing lib, etc. Warns if already exists and does NOT overwrite.
 * @param {string} projType - The user's desired project type.
 * @param {object} argv - The arguments object provided by yargs.
 * @param {string} argv.asm - Add .asm dir to project.
 * @param {string} argv.name - The user's desired project name.
 * @return {Promise<void>}
 */
export async function project(projType, options: ProjectCommandOptions, name: string) {
  if (name.search(/[^-0-9a-zA-Z]/g) != -1) {
    console.error(red(`Invalid project name format`));
    exit(-1);
  }

  if (existsSync(name)) {
    console.error(red(`Directory already exists. Not proceeding`));
    exit(-1);
  }

  // Git must be initialized before running `npm install` b/c Husky runs an
  // NPM `prepare` script to set up its pre-commit hook within `.git`.
  // Check before fetching project template, to not leave crud on user's system.
  if (!sh.which('git')) {
    console.error(red('Please ensure Git is installed, then try again.'));
    exit(-1);
  }

  // Create path/to/dir with their desired name
  if (sh.mkdir('-p', name).code != 0) {
    exit(-1);
  }
  sh.cd(name); // Set dir for shell commands. Doesn't change user's dir in their CLI.

  // Initialize .git in the root, whether monorepo or not.
  await stepCmd('Initialize Git repo', 'git init -q');

  if (projType == ProjectType.Contract) {
    if (!(await fetchProjectTemplate('demo-contract'))) return;
  } else if (projType == ProjectType.Library) {
    if (!(await fetchProjectTemplate('demo-lib'))) return;
  } else if (projType == ProjectType.StatefulContract) {
    if (!(await fetchProjectTemplate('counter'))) return;
  } else {
    exit(-1);
  }

  // `/dev/null` on Mac or Linux and 'NUL' on Windows is the only way to silence
  // Husky's install log msg. (Note: The contract project template commits
  // package-lock.json so we can use `npm ci` for faster installation.)

  //await stepCmd(
  //  'NPM install',
  //  `npm ci --silent > ${isWindows ? 'NUL' : '"/dev/null" 2>&1'}`
  //);

  //// Build the template contract so it can be imported into the ui scaffold
  //await stepCmd('NPM build contract', 'npm run build --silent');

  await setProjectName('.', name.split(sep).pop());

  // `-n` (no verify) skips Husky's pre-commit hooks.
  //await stepCmd(
  //  'Git init commit',
  //  'git add . && git commit -m "Init commit" -q -n && git branch -m main'
  //);
  //

  await configurePackageJson('.', options.asm);

  if (options.asm) {
    await createAsmDir();
  }

  let resStr = `\nProject ${name} was successfully created!`;

  resStr +=
    `\n\nAdd your Git repo URL and you're good to go:` +
    `\ncd ${name} && git remote add origin <your-repo-url>`;

  console.log(green(resStr));
  exit(0);
}

/**
 * Fetch project template.
 * @returns {Promise<boolean>} - True if successful; false if not.
 */
async function fetchProjectTemplate(projectName: string) {
  const step = 'Set up project';
  const spin = ora({ text: `${step}...`, discardStdin: true }).start();

  try {
    await unTarTemplates(projectName, '.');
    spin.succeed(green(step));
    return true;
  } catch (err) {
    spin.fail(step);
    console.error(err);
    return false;
  }
}

/**
 * Step to replace placeholder names in the project with the properly-formatted
 * version of the user-supplied name as specified via `zk project <name>`
 * @param {string} dir - Path to the dir containing target files to be changed.
 * @param {string} name - User-provided project name.
 * @returns {Promise<void>}
 */
async function setProjectName(dir, name) {
  const step = 'Set project name';
  const spin = ora(`${step}...`).start();

  replaceInFile(join(dir, 'README.md'), PROJECT_NAME_TEMPLATE, titleCase(name));
  replaceInFile(join(dir, 'package.json'), PROJECT_PACKAGE_NAME_TEMPLATE, kebabCase(name));

  // Rename contract and test files w project name.
  // Also rename template inside these files.
  const dirSrc = join(dir, 'src');
  const fIndex = join(dirSrc, 'index.ts');
  if (existsSync(fIndex)) {
    replaceInFile(fIndex, PROJECT_FILENAME_TEMPLATE, camelCase(name));
    replaceInFile(fIndex, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
  }

  const dirContracts = join(dirSrc, 'contracts');
  const fContract = join(dirContracts, PROJECT_NAME_TEMPLATE + '.ts');
  const fContractNew = fContract.replace(PROJECT_NAME_TEMPLATE, camelCase(name));
  if (existsSync(fContract)) {
    sh.mv(fContract, fContractNew);
    replaceInFile(fContractNew, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
  }

  const ftestContract = join(dirContracts, 'test' + PROJECT_NAME_TEMPLATE + '.ts');
  const ftestContractNew = ftestContract.replace(PROJECT_NAME_TEMPLATE, camelCase(name));

  if (existsSync(ftestContract)) {
    sh.mv(ftestContract, ftestContractNew);
    replaceInFile(ftestContractNew, PROJECT_FILENAME_TEMPLATE, camelCase(name));
    replaceInFile(ftestContractNew, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
  }

  const dirTests = join(dir, 'tests');
  const fTest = join(dirTests, PROJECT_NAME_TEMPLATE + '.test.ts');
  const fTestNew = fTest.replace(PROJECT_NAME_TEMPLATE, camelCase(name));
  if (existsSync(fTest)) {
    sh.mv(fTest, fTestNew);
    replaceInFile(fTestNew, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
    replaceInFile(fTestNew, PROJECT_PACKAGE_NAME_TEMPLATE, kebabCase(name));
  }

  const fDeployScript = join(dir, 'deploy.ts');
  if (existsSync(fDeployScript)) {
    replaceInFile(fDeployScript, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
    replaceInFile(fDeployScript, PROJECT_PACKAGE_NAME_TEMPLATE, kebabCase(name));
  }

  const importTemplateLaunch = `${PROJECT_NAME_TEMPLATE}`;
  const importReplacementLaunch = importTemplateLaunch.replace(
    PROJECT_NAME_TEMPLATE,
    camelCase(name),
  );
  const fLaunch = join(dir, '.vscode', 'launch.json');
  if (existsSync(fLaunch)) {
    replaceInFile(fLaunch, importTemplateLaunch, importReplacementLaunch);
    replaceInFile(fLaunch, PROJECT_NAME_TEMPLATE, camelCaseCapitalized(name));
  }

  spin.succeed(green(step));
}

/**
 * Apply modifications to package.json if needed.
 * @param {string} dir - Path to the dir containing target files to be changed.
 * @param {string} asm - Configure for ASM optimizations.
 * @param {string} minimal - Use minimal config. Defaults to false.
 * @returns {Promise<boolean>} - True if successful; false if not.
 */
async function configurePackageJson(dir, asm) {
  const step = 'Configure package.json ';
  const spin = ora(`${step}...`).start();

  const packageJsonPath = join(dir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());

  // lock @scyrpt-inc/cli-opcat version
  packageJson.scripts['compile'] = 'npx -y @opcat-labs/cli-opcat@' + version + ' compile';

  if (asm) {
    packageJson.scripts['compile'] += ' --asm';
  }

  writefile(packageJsonPath, packageJson);

  spin.succeed(green(step));
}
