import { Command, CommandRunner, Option } from 'nest-commander';
import { red } from 'chalk';
import { project, ProjectCommandOptions, ProjectType } from './project';

@Command({
  name: 'project',
  arguments: '<name>',
  description: 'Create a new smart contract project',
})
export class ProjectCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(passedParams: string[], options?: ProjectCommandOptions): Promise<void> {
    if (options.state && options.lib) {
      console.log(red('Flags "--state" and "--lib" cannot be used together.'));
      return;
    }

    const [name] = passedParams;

    if (options.state) {
      await project(ProjectType.StatefulContract, options, name);
    } else if (options.lib) {
      await project(ProjectType.Library, options, name);
    } else {
      await project(ProjectType.Contract, options, name);
    }
  }

  @Option({
    flags: '-s, --state [state]',
    description: 'Create stateful smart contract project',
  })
  parseStateful(_val: string): boolean {
    return true;
  }

  @Option({
    flags: '-l, --lib [lib]',
    description: 'Create library project',
  })
  parseLibrary(_val: string): boolean {
    return true;
  }

  @Option({
    flags: '--asm [asm]',
    description: 'Include inline ASM script',
  })
  parseAsm(_val: string): boolean {
    return true;
  }

  @Option({
    flags: '--min [min]',
    description: 'Include only minimal dependencies and configs',
  })
  parseMinimal(_val: string): boolean {
    return true;
  }
}
