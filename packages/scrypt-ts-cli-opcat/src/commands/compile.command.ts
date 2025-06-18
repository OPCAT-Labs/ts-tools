import { Command, CommandRunner, Option } from 'nest-commander';
import { compile, CompileCommandOptions } from './compile';

@Command({
  name: 'compile',
  description: 'Compile smart contracts in current project',
})
export class CompileCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(_passedParams: string[], options?: CompileCommandOptions): Promise<void> {
    return compile(options);
  }

  @Option({
    flags: '-i, --include [include]',
    description:
      'Specifies an array of filenames or patterns to include when compling.  Defaults "src/contracts/**/*.ts".',
  })
  parseInclude(val: string): string {
    return val;
  }

  @Option({
    flags: '-e, --exclude [exclude]',
    description:
      'Specifies an array of filenames or patterns that should be skipped when resolving include. Defaults none.',
  })
  parseExclude(val: string): string {
    return val;
  }

  @Option({
    flags: '-t, --tsconfig [tsconfig]',
    description: 'Specify a tsconfig to override the default tsconfig.',
  })
  parseTsconfig(val: string): string {
    return val;
  }

  @Option({
    flags: '-w, --watch [watch]',
    description: 'Watch input files.',
  })
  parseWatch(): boolean {
    return true;
  }

  @Option({
    flags: '--noArtifact [noArtifact]',
    description: 'Disable emitting artifact file from a compilation.',
  })
  parseNoArtifact(): boolean {
    return true;
  }

  @Option({
    flags: '-a, --asm [asm]',
    description: 'Apply asm optimization before compiling scrypt file.',
  })
  parseAsm(): boolean {
    return true;
  }
}
