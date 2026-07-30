const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import { CoreBridge } from '@the-andb/core';
import { CliStorageStrategy } from '../storage/strategy/cli-storage.strategy';

const logger = getLogger({ logName: 'ExportCommand' });

// Exit codes:
//   0 - export completed with no per-object errors
//   1 - export failed outright (connection error, thrown exception, etc.)
//   3 - export completed but one or more objects failed to export
//       (partial success — see stderr for which objects/why)
export function register(program: Command) {
  program
    .command('export')
    .description('Export database schema to files')
    .option('-e, --env <env>', 'Environment name to export')
    .option('-n, --name <name>', 'Specific object name to export')
    .addHelpText(
      'after',
      '\nExit codes:\n' +
      '  0  success, no per-object errors\n' +
      '  1  export failed outright (connection error, exception, etc.)\n' +
      '  3  completed with partial errors — one or more objects failed to export (see stderr)\n',
    )
    .action(async (options: any, cmd: any) => {
      const env = options.env || cmd.args?.[0];

      if (!env) {
        logger.error('Environment name is required. Usage: andb export <env>');
        return;
      }

      try {
        const strategy = new CliStorageStrategy();
        const container = await CoreBridge.init(process.cwd(), '', strategy);
        logger.info(`Starting export for environment: ${env}`);
        const result = await container.exporter.exportSchema(env, options.name);
        console.table(result);

        const errorCount = result?.errorCount ?? 0;
        const errors: { type: string; name: string; message: string }[] = result?.errors ?? [];

        if (errorCount > 0) {
          logger.warn(`Export completed with ${errorCount} error(s).`);
          console.error('\n--- Export Errors ---');
          errors.forEach((e) => {
            console.error(`  ❌ [${e.type}] ${e.name}: ${e.message}`);
          });
          process.exitCode = 3;
        } else {
          logger.info(`Export completed successfully!`);
          process.exitCode = 0;
        }

        // Surface per-table row-export truncation, if the result carries it
        // (currently only exportTableData reports `truncated`; exportSchema's
        // DDL export does not cap rows, so this is defensive for future shapes).
        const truncatedTables: string[] = Object.entries(result || {})
          .filter(([, v]: [string, any]) => v && typeof v === 'object' && v.truncated === true)
          .map(([k]) => k);
        if (truncatedTables.length > 0) {
          console.error(`\n⚠️  The following tables hit the row-export cap and may be truncated: ${truncatedTables.join(', ')}`);
        }
      } catch (error: any) {
        logger.error(`Export failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
}
