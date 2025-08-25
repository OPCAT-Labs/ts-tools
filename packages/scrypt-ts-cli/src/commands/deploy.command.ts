import { Command, CommandRunner, Option } from 'nest-commander';
import { isProjectRoot, shExec, stepCmd } from '../common/utils';
import { red, green } from 'chalk';
import { exit } from 'process';
import { existsSync } from 'fs';
import { join } from 'path';
export interface DeployCommandOptions {
  file?: string;
}

@Command({
  name: 'deploy',
  description: 'Deploy a smart contract',
})
export class DeployCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(_passedParams: string[], options?: DeployCommandOptions): Promise<void> {
    return this.deploy(options);
  }

  @Option({
    flags: '-f, --file [file]',
    required: true,
    description: 'Path to deployment script. Defaults to "deploy.ts" if none specified.',
  })
  parseFile(val: string): string {
    return val;
  }

  async deploy(options: DeployCommandOptions) {
    if (!isProjectRoot()) {
      console.error(red(`Please run this command in the root directory of the project.`));
      exit(-1);
    }

    if (options.file && !existsSync(options.file)) {
      console.error(red(`Deploy script "${options.file}" not found.`));
      exit(-1);
    }

    // TODO: If private key was generated just now, then exit.
    await stepCmd('Generating private key', 'npm run genprivkey');

    // Run deploy script.
    try {
      let deployScriptPath = options.file ? options.file : join('.', 'deploy.ts');

      if (!existsSync(deployScriptPath)) {
        deployScriptPath = join('.', 'scripts', 'deploy.ts');
      }

      // Check if script exists, if not, create one.
      if (!existsSync(deployScriptPath)) {
        console.error(red(`Not deploy script found.`));
        exit(-1);
      }

      console.log(green(`Running deployment script "${deployScriptPath}"...`));

      await shExec(`npx tsx ${deployScriptPath}`);
    } catch (e) {
      console.error(red(`Running deployment script "${options.file}" failed, ${e}`));
      exit(-1);
    }

    exit(0);
  }
}
