import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Command({
  name: 'init',
  description: 'Initialize a new Andb project with default config',
})
export class InitCommand extends CommandRunner {
  private readonly logger = new Logger(InitCommand.name);

  async run(): Promise<void> {
    const cwd = process.cwd();
    const yamlPath = path.join(cwd, 'andb.yaml');

    if (fs.existsSync(yamlPath)) {
      this.logger.warn('andb.yaml already exists. Skipping initialization.');
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
  pattern: "dev\.example\.com"
  replacement: "prod\.example\.com"
`;

    try {
      fs.writeFileSync(yamlPath, defaultConfig.trim() + '\n');
      this.logger.log('✅ Created andb.yaml successfully!');

      // Also update package.json with scripts
      this.logger.log('Updating package.json with utility scripts...');
      // We can use GenerateCommand logic here or just tell user to run andb generate
      console.log('\nSuggested next step: Run "andb generate" to create scripts in package.json\n');
    } catch (error: any) {
      this.logger.error(`Failed to initialize project: ${error.message}`);
    }
  }
}
