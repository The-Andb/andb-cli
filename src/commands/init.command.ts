const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger({ logName: 'InitCommand' });

export function register(program: Command) {
  program
    .command('init')
    .description('Initialize a new Andb project with default config')
    .action(async () => {
      const cwd = process.cwd();
      const yamlPath = path.join(cwd, 'andb.yaml');

      if (fs.existsSync(yamlPath)) {
        logger.warn('andb.yaml already exists. Skipping initialization.');
        return;
      }

      const defaultConfig = `
# The Andb Configuration
# Documentation: https://github.com/The-Andb/andb

# Environment Order (Migration Flow)
order:
  - DEV
  - STAGE
  - PROD

# Connection Settings
environments:
  DEV:
    host: localhost
    port: 3306
    database: my_app_dev
    username: root
    password: ""
  STAGE:
    host: stage-db.example.com
    port: 3306
    database: my_app_stage
    username: admin
    password: "secure_password"
  PROD:
    host: prod-db.example.com
    port: 3306
    database: my_app_prod
    username: deploy
    password: "ultra_secure_password"

# Optional: Domain/Data Normalization
normalization:
  pattern: "dev\\.example\\.com"
  replacement: "prod\\.example\\.com"
`;

      try {
        fs.writeFileSync(yamlPath, defaultConfig.trim() + '\n');
        logger.info('✅ Created andb.yaml successfully!');
        logger.info('Updating package.json with utility scripts...');
        console.log('\nSuggested next step: Run "andb generate" to create scripts in package.json\n');
      } catch (error: any) {
        logger.error(`Failed to initialize project: ${error.message}`);
      }
    });
}
