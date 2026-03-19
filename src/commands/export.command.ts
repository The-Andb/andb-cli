const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import { Container } from '@the-andb/core';

const logger = getLogger({ logName: 'ExportCommand' });

export function register(program: Command) {
  program
    .command('export')
    .description('Export database schema to files')
    .option('-e, --env <env>', 'Environment name to export')
    .option('-n, --name <name>', 'Specific object name to export')
    .action(async (options: any, cmd: any) => {
      const env = options.env || cmd.args?.[0];

      if (!env) {
        logger.error('Environment name is required. Usage: andb export <env>');
        return;
      }

      try {
        const container = await Container.create();
        logger.info(`Starting export for environment: ${env}`);
        const result = await container.exporter.exportSchema(env, options.name);
        logger.info(`Export completed successfully!`);
        console.table(result);
      } catch (error: any) {
        logger.error(`Export failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
}
