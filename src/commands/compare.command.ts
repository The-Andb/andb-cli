const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import { Container } from '@the-andb/core';
import * as path from 'path';
import * as yaml from 'js-yaml';

const logger = getLogger({ logName: 'CompareCommand' });

export function register(program: Command) {
  program
    .command('compare')
    .description('Compare two database schemas')
    .argument('[src]', 'Source environment')
    .argument('[dest]', 'Destination environment')
    .option('-s, --source <source>', 'Source environment')
    .option('-d, --dest <dest>', 'Destination environment')
    .option('-r, --report [path]', 'Generate HTML report')
    .option('-f, --format [type]', 'Output format (text, json, yaml)', 'text')
    .option('--auto-backup [boolean]', 'Enable/disable auto-backup')
    .action(async (srcArg: string, destArg: string, options: any) => {
      const sourceEnv = options.source || srcArg;
      const destEnv = options.dest || destArg;

      if (!sourceEnv || !destEnv) {
        logger.error('Source and Destination environments are required. Usage: andb compare <src> <dest>');
        return;
      }

      try {
        const container = Container.create();
        const comparator = container.comparator;
        const driverFactory = container.driverFactory;
        const configService = container.config;
        const reporter = container.reporter;

        const format = options.format || 'text';
        const isMachineReadable = format === 'json' || format === 'yaml';

        if (!isMachineReadable) {
          logger.info(`Comparing ${sourceEnv} (Source) -> ${destEnv} (Destination)`);
        }

        if (options.autoBackup !== undefined) {
          (configService as any).setAutoBackup(options.autoBackup !== 'false');
        }

        const srcConn = configService.getConnection(sourceEnv);
        const destConn = configService.getConnection(destEnv);

        if (!srcConn || !destConn) {
          throw new Error('Could not find connection config for one or both environments');
        }

        const srcDriver = await driverFactory.create(srcConn.type, srcConn.config);
        const destDriver = await driverFactory.create(destConn.type, destConn.config);

        try {
          await srcDriver.connect();
        } catch (err: any) {
          logger.error(`Source connection failed (${sourceEnv}): ${err.message}`);
          if (isMachineReadable) {
            process.stdout.write(JSON.stringify({ error: `Source connection failed: ${err.message}`, exitCode: 1 }) + '\n');
          }
          process.exitCode = 1;
          return;
        }

        try {
          await destDriver.connect();
        } catch (err: any) {
          logger.error(`Destination connection failed (${destEnv}): ${err.message}`);
          await srcDriver.disconnect();
          if (isMachineReadable) {
            process.stdout.write(JSON.stringify({ error: `Destination connection failed: ${err.message}`, exitCode: 1 }) + '\n');
          }
          process.exitCode = 1;
          return;
        }

        try {
          const diff = await comparator.compareSchema(
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
            logger.info('Comparison completed!');
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
            console.error('\n⚠️  DESTRUCTIVE CHANGES DETECTED: This migration includes DROP operations.');
          }

          process.exitCode = exitCode;

          if (options.report) {
            const reportPath =
              typeof options.report === 'string'
                ? options.report
                : path.join(process.cwd(), 'reports', `report-${destEnv}.html`);
            await reporter.generateHtmlReport(
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
        logger.error(`Comparison failed: ${error.message}`);
        process.exit(1);
      }
    });
}
