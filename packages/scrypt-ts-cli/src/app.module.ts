import { Module } from '@nestjs/common';
import { VersionCommand } from './commands/version.command';
import { SystemCommand } from './commands/system.command';
import { ProjectCommand } from './commands/project.command';
import { CompileCommand } from './commands/compile.command';
import { DeployCommand } from './commands/deploy.command';

@Module({
  imports: [],
  controllers: [],
  providers: [VersionCommand, SystemCommand, ProjectCommand, CompileCommand, DeployCommand],
})
export class AppModule {}
