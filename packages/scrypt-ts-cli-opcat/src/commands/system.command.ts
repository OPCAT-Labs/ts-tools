import { Command, CommandRunner } from 'nest-commander';
import envinfo from 'envinfo';

@Command({
  name: 'system',
  description: 'Show system info',
})
export class SystemCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(): Promise<void> {
    console.log('Please include the following when submitting a Github issue:');

    envinfo
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'Yarn', 'npm'],
          npmPackages: ['@opcat-labs/scrypt-ts-transpiler-opcat', '@opcat-labs/scrypt-ts-opcat'],
        },
        { showNotFound: true },
      )
      .then((env) => console.log(env));
  }
}
