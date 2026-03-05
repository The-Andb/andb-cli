const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import * as fs from 'fs';
import {
  ParserService,
  ComparatorService,
  MigratorService,
  MysqlMigrator,
} from '@the-andb/core';
import * as yaml from 'js-yaml';

const logger = getLogger({ logName: 'PlaygroundCommand' });

export function register(program: Command) {
  program
    .command('playground')
    .description('Test andb-core semantic diffing by comparing two local SQL files')
    .option('-s, --source [path]', 'Path to the source SQL file (e.g., current schema)')
    .option('-t, --target [path]', 'Path to the target SQL file (e.g., desired schema)')
    .option('-f, --format [type]', 'Output format (text, json, yaml)', 'text')
    .action(async (options: any) => {
      if (!options.source || !options.target) {
        logger.error('Both --source and --target files are required.');
        process.exit(1);
      }

      try {
        const parser = new ParserService();
        const comparator = new ComparatorService(parser, {} as any, { getDomainNormalization: () => ({ pattern: /(?!)/, replacement: '' }) });
        const migrator = new MigratorService();

        const srcDDL = fs.readFileSync(options.source, 'utf-8');
        const targetDDL = fs.readFileSync(options.target, 'utf-8');

        const format = options.format || 'text';
        const isMachineReadable = format === 'json' || format === 'yaml';

        if (!isMachineReadable) {
          logger.info(`Comparing ${options.source} against ${options.target}...`);
        }

        const srcTable = parser.parseTable(srcDDL);
        const destTable = parser.parseTable(targetDDL);

        if (!isMachineReadable) {
          logger.info('--- Parsed Current Schema Table (Target) ---');
          console.error(JSON.stringify(srcTable, null, 2));

          logger.info('--- Parsed Desired Schema Table (Source) ---');
          console.error(JSON.stringify(destTable, null, 2));
        }

        const diffOps = comparator.compareTables(targetDDL, srcDDL);

        const defaultMigrator = new MysqlMigrator();
        const sqls = migrator.generateAlterSQL(diffOps, defaultMigrator);

        let exitCode = 0;
        let hasDestructive = false;

        if (diffOps.hasChanges && sqls.length > 0) {
          hasDestructive = diffOps.operations.some((op: any) => op.type === 'DROP');
          exitCode = hasDestructive ? 2 : 1;
        }

        if (isMachineReadable) {
          const output = {
            hasChanges: diffOps.hasChanges,
            destructive: hasDestructive,
            operations: diffOps.operations,
            sqls,
            exitCode,
          };

          if (format === 'json') {
            process.stdout.write(JSON.stringify(output, null, 2) + '\n');
          } else {
            process.stdout.write(yaml.dump(output) + '\n');
          }
        } else {
          console.error('--- Diff Operations ---');
          console.error(JSON.stringify(diffOps, null, 2));

          console.error('--- Generated ALTER TABLE SQL ---');
          if (sqls.length > 0) {
            sqls.forEach((sql) => console.log(sql));
          } else {
            console.error('✅ Tables are structurally identical.');
          }
        }

        if (exitCode === 2) {
          console.error('\n⚠️  DESTRUCTIVE CHANGES DETECTED: This transformation includes DROP operations.');
        }

        process.exitCode = exitCode;
      } catch (error: any) {
        logger.error(`Playground execution failed: ${error.message}`);
        process.exit(1);
      }
    });
}
