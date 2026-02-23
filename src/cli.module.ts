import { Module } from '@nestjs/common';
import { GenerateCommand } from './commands/generate.command';
import { HelperCommand } from './commands/helper.command';
import { ExportCommand } from './commands/export.command';
import { CompareCommand } from './commands/compare.command';
import { MigrateCommand } from './commands/migrate.command';
import { InitCommand } from './commands/init.command';
import { PlaygroundCommand } from './commands/playground.command';

import {
  ParserModule,
  DriverModule,
  ComparatorModule,
  MigratorModule,
  ProjectConfigModule,
  ExporterModule,
  ReporterModule,
  StorageModule,
  OrchestrationModule,
} from '@the-andb/core';

@Module({
  imports: [
    ParserModule,
    DriverModule,
    ComparatorModule,
    MigratorModule,
    ProjectConfigModule,
    ExporterModule,
    ReporterModule,
    StorageModule,
    OrchestrationModule,
  ],
  controllers: [],
  providers: [
    GenerateCommand,
    HelperCommand,
    ExportCommand,
    CompareCommand,
    MigrateCommand,
    InitCommand,
    PlaygroundCommand,
  ],
})
export class CliModule { }
