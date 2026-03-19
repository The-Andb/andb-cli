import { Command } from 'commander';
import { Container } from '@the-andb/core';
const { getLogger } = require('andb-logger');

const logger = getLogger({ logName: 'SearchCommand' });

export function register(program: Command) {
  program
    .command('search')
    .description('Search for object dependencies (usages of SP/FN/Table)')
    .argument('<name>', 'Object name to search for')
    .option('-e, --env <environment>', 'Environment to search in', 'DEV')
    .action(async (name: string, options: any) => {
      const container = await Container.create();
      const searchService = container.dependencySearch;
      const configService = container.config;
      const driverFactory = container.driverFactory;

      const env = options.env;
      logger.info(`Searching for usages of "${name}" in environment: ${env}`);

      try {
        const conn = configService.getConnection(env);
        if (!conn) {
          throw new Error(`Connection config for environment "${env}" not found`);
        }

        const driver = await driverFactory.create(conn.type, conn.config);
        await driver.connect();

        try {
          const results = await searchService.searchUsages(driver, conn.config.database || 'default', name);
          
          if (results.length === 0) {
            logger.info(`No usages found for "${name}".`);
            return;
          }

          console.error(`\nFound ${results.length} objects referencing "${name}":\n`);
          
          for (const result of results) {
            console.error(`✨ [${result.sourceObject.type}] ${result.sourceObject.name}`);
            for (const match of result.matches) {
              console.error(`  Line ${match.line}: ${match.content}`);
              // console.error(`  Context:\n${match.contextSnippet}\n`);
            }
            console.error('');
          }
        } finally {
          await driver.disconnect();
        }
      } catch (error: any) {
        logger.error(`Search failed: ${error.message}`);
        process.exit(1);
      }
    });
}
