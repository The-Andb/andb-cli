import { Command, CommandRunner, Option } from 'nest-commander';
import { ExporterService } from '@the-andb/core';
import { Logger } from '@nestjs/common';

interface ExportCommandOptions {
  env?: string;
  name?: string;
}

@Command({
  name: 'export',
  description: 'Export database schema to files',
})
export class ExportCommand extends CommandRunner {
  private readonly logger = new Logger(ExportCommand.name);

  constructor(private readonly exporter: ExporterService) {
    super();
  }

  async run(passedParam: string[], options?: ExportCommandOptions): Promise<void> {
    const env = options?.env || passedParam[0];

    if (!env) {
      this.logger.error('Environment name is required. Usage: andb export <env>');
      return;
    }

    try {
      this.logger.log(`Starting export for environment: ${env}`);
      const result = await this.exporter.exportSchema(env, options?.name);
      this.logger.log(`Export completed successfully!`);
      console.table(result);
    } catch (error: any) {
      this.logger.error(`Export failed: ${error.message}`);
    }
  }

  @Option({
    flags: '-e, --env <env>',
    description: 'Environment name to export',
  })
  parseEnv(val: string): string {
    return val;
  }

  @Option({
    flags: '-n, --name <name>',
    description: 'Specific object name to export',
  })
  parseName(val: string): string {
    return val;
  }
}
