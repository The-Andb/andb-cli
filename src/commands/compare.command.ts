import { Command, CommandRunner, Option } from 'nest-commander';
import { ComparatorService } from '@the-andb/core';
import { DriverFactoryService } from '@the-andb/core';
import { ProjectConfigService } from '@the-andb/core';
import { ReporterService } from '@the-andb/core';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface CompareCommandOptions {
  source?: string;
  dest?: string;
  report?: string;
  format?: 'text' | 'json' | 'yaml';
  autoBackup?: boolean;
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
      const format = options?.format || 'text';
      const isMachineReadable = format === 'json' || format === 'yaml';

      if (!isMachineReadable) {
        this.logger.log(`Comparing ${sourceEnv} (Source) -> ${destEnv} (Destination)`);
      }

      if (options?.autoBackup !== undefined) {
        (this.configService as any).setAutoBackup(options.autoBackup);
      }

      const srcConn = this.configService.getConnection(sourceEnv);
      const destConn = this.configService.getConnection(destEnv);

      if (!srcConn || !destConn) {
        throw new Error('Could not find connection config for one or both environments');
      }

      const srcDriver = await this.driverFactory.create(srcConn.type, srcConn.config);
      const destDriver = await this.driverFactory.create(destConn.type, destConn.config);

      try {
        await srcDriver.connect();
      } catch (err: any) {
        this.logger.error(`Source connection failed (${sourceEnv}): ${err.message}`);
        if (isMachineReadable) {
          process.stdout.write(JSON.stringify({ error: `Source connection failed: ${err.message}`, exitCode: 1 }) + '\n');
        }
        process.exitCode = 1;
        return;
      }

      try {
        await destDriver.connect();
      } catch (err: any) {
        this.logger.error(`Destination connection failed (${destEnv}): ${err.message}`);
        await srcDriver.disconnect();
        if (isMachineReadable) {
          process.stdout.write(JSON.stringify({ error: `Destination connection failed: ${err.message}`, exitCode: 1 }) + '\n');
        }
        process.exitCode = 1;
        return;
      }

      try {
        const diff = await this.comparator.compareSchema(
          srcDriver.getIntrospectionService(),
          destDriver.getIntrospectionService(),
          srcConn.config.database || 'default',
        );

        let hasDestructive = false;
        if (diff.summary.totalChanges > 0) {
          for (const tableName in diff.tables) {
            if (diff.tables[tableName].operations.some((op: any) => op.type === 'DROP')) {
              hasDestructive = true;
              break;
            }
          }
          if (!hasDestructive && diff.droppedTables.length > 0) hasDestructive = true;
          if (!hasDestructive && diff.objects.some((obj) => obj.operation === 'DROP')) hasDestructive = true;
        }

        let exitCode = 0;
        if (diff.summary.totalChanges > 0) {
          exitCode = hasDestructive ? 2 : 1;
        }

        if (isMachineReadable) {
          const output = {
            summary: diff.summary,
            tables: diff.tables,
            droppedTables: diff.droppedTables,
            objects: diff.objects,
            destructive: hasDestructive,
            exitCode,
          };

          if (format === 'json') {
            process.stdout.write(JSON.stringify(output, null, 2) + '\n');
          } else {
            process.stdout.write(yaml.dump(output) + '\n');
          }
        } else {
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
        }

        if (hasDestructive) {
          // Always warn about destructive changes to stderr
          console.error('\n⚠️  DESTRUCTIVE CHANGES DETECTED: This migration includes DROP operations.');
        }

        process.exitCode = exitCode;

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
          if (!isMachineReadable) {
            console.log(`\n📄 HTML Report generated: ${reportPath}`);
          }
        }
      } finally {
        await srcDriver.disconnect();
        await destDriver.disconnect();
      }
    } catch (error: any) {
      this.logger.error(`Comparison failed: ${error.message}`);
      process.exit(1);
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

  @Option({
    flags: '-f, --format [type]',
    description: 'Output format (text, json, yaml)',
    defaultValue: 'text',
  })
  parseFormat(val: string): string {
    return val;
  }

  @Option({
    flags: '--auto-backup [boolean]',
    description: 'Enable/disable auto-backup before migration (default: true)',
  })
  parseAutoBackup(val: string): boolean {
    return val !== 'false';
  }
}
