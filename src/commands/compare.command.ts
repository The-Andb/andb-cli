import { Command, CommandRunner, Option } from 'nest-commander';
import { ComparatorService } from '@the-andb/core';
import { DriverFactoryService } from '@the-andb/core';
import { ProjectConfigService } from '@the-andb/core';
import { ReporterService } from '@the-andb/core';
import { Logger } from '@nestjs/common';
import * as path from 'path';

interface CompareCommandOptions {
  source?: string;
  dest?: string;
  report?: string;
}

@Command({
  name: 'compare',
  description: 'Compare two database schemas',
})
export class CompareCommand extends CommandRunner {
  private readonly logger = new Logger(CompareCommand.name);

  constructor(
    private readonly comparator: ComparatorService,
    private readonly driverFactory: DriverFactoryService,
    private readonly configService: ProjectConfigService,
    private readonly reporter: ReporterService,
  ) {
    super();
  }

  async run(passedParam: string[], options?: CompareCommandOptions): Promise<void> {
    const sourceEnv = options?.source || passedParam[0];
    const destEnv = options?.dest || passedParam[1];

    if (!sourceEnv || !destEnv) {
      this.logger.error(
        'Source and Destination environments are required. Usage: andb compare <src> <dest>',
      );
      return;
    }

    try {
      this.logger.log(`Comparing ${sourceEnv} (Source) -> ${destEnv} (Destination)`);

      const srcConn = this.configService.getConnection(sourceEnv);
      const destConn = this.configService.getConnection(destEnv);

      if (!srcConn || !destConn) {
        throw new Error('Could not find connection config for one or both environments');
      }

      const srcDriver = await this.driverFactory.create(srcConn.type, srcConn.config);
      const destDriver = await this.driverFactory.create(destConn.type, destConn.config);

      try {
        await srcDriver.connect();
        await destDriver.connect();

        const diff = await this.comparator.compareSchema(
          srcDriver.getIntrospectionService(),
          destDriver.getIntrospectionService(),
          srcConn.config.database || 'default',
        );

        this.logger.log('Comparison completed!');
        console.log('\n--- Summary ---');
        console.table(diff.summary);

        if (diff.summary.totalChanges > 0) {
          console.log('\n--- Tables ---');
          for (const tableName in diff.tables) {
            console.log(`⚠️  ${tableName}: ${diff.tables[tableName].operations.length} changes`);
          }
          if (diff.droppedTables.length > 0) {
            console.log(`🗑️  Dropped Tables: ${diff.droppedTables.join(', ')}`);
          }

          console.log('\n--- Objects ---');
          diff.objects.forEach((obj) => {
            console.log(`✨ [${obj.type}] ${obj.name} (${obj.operation})`);
          });
        } else {
          console.log('✅ Schemas are identical!');
        }

        if (options?.report) {
          const reportPath =
            typeof options.report === 'string'
              ? options.report
              : path.join(process.cwd(), 'reports', `report-${destEnv}.html`);
          await this.reporter.generateHtmlReport(
            `${sourceEnv} -> ${destEnv}`,
            destConn.config.database || 'default',
            diff,
            reportPath,
          );
          console.log(`\n📄 HTML Report generated: ${reportPath}`);
        }
      } finally {
        await srcDriver.disconnect();
        await destDriver.disconnect();
      }
    } catch (error: any) {
      this.logger.error(`Comparison failed: ${error.message}`);
    }
  }

  @Option({
    flags: '-r, --report [path]',
    description: 'Generate HTML report',
  })
  parseReport(val: string): string | boolean {
    return val || true;
  }

  @Option({
    flags: '-s, --source <source>',
    description: 'Source environment',
  })
  parseSource(val: string): string {
    return val;
  }

  @Option({
    flags: '-d, --dest <dest>',
    description: 'Destination environment',
  })
  parseDest(val: string): string {
    return val;
  }
}
