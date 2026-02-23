import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface GenerateOptions {
  environments?: string;
  compareEnvs?: string;
  migrateEnvs?: string;
}

@Command({
  name: 'generate',
  aliases: ['gen'],
  description: 'Generate scripts and utilities for package.json',
})
export class GenerateCommand extends CommandRunner {
  private readonly logger = new Logger(GenerateCommand.name);

  private readonly DDL_TYPES = ['fn', 'sp', 'tbl', 'trg', 'views', 'events'];
  private readonly DDL_MAPPING: Record<string, string> = {
    fn: '-f',
    sp: '-p',
    tbl: '-t',
    trg: '-tr',
    views: '-v',
    events: '-e', // Assuming events might be added
  };
  private readonly OTE_DDL_TYPES = ['fn', 'sp'];

  async run(inputs: string[], options: GenerateOptions): Promise<void> {
    const envs = this.getEnvironments(options.environments);
    const compareEnvs = this.getCompareEnvironments(options.compareEnvs, envs);
    const migrateEnvs = this.getMigrateEnvironments(options.migrateEnvs, envs);

    this.logger.log(`Environments: ${envs.join(', ')}`);
    this.updatePackageJson(envs, compareEnvs, migrateEnvs);
  }

  @Option({
    flags: '-e, --environments <list>',
    description: 'Comma-separated list of environments (e.g., DEV,PROD)',
  })
  parseEnvironments(val: string): string {
    return val;
  }

  @Option({
    flags: '-c, --compare-envs <list>',
    description: 'Comma-separated list of environments for comparison',
  })
  parseCompareEnvs(val: string): string {
    return val;
  }

  @Option({
    flags: '-m, --migrate-envs <list>',
    description: 'Comma-separated list of environments for migration',
  })
  parseMigrateEnvs(val: string): string {
    return val;
  }

  private getEnvironments(optionEnv?: string): string[] {
    if (optionEnv) {
      return optionEnv.split(',').map((e) => e.trim().toUpperCase());
    }
    // TODO: Read from config file context if available (adr-00x)
    return ['LOCAL', 'DEV', 'UAT', 'STAGE', 'PROD'];
  }

  private getCompareEnvironments(optionEnv: string | undefined, allEnvs: string[]): string[] {
    if (optionEnv) return optionEnv.split(',').map((e) => e.trim().toUpperCase());
    return allEnvs.filter((env) => env !== 'LOCAL');
  }

  private getMigrateEnvironments(optionEnv: string | undefined, allEnvs: string[]): string[] {
    if (optionEnv) return optionEnv.split(',').map((e) => e.trim().toUpperCase());
    return allEnvs.filter((env) => !['LOCAL', 'DEV'].includes(env));
  }

  private updatePackageJson(envs: string[], compareEnvs: string[], migrateEnvs: string[]) {
    const baseDir = process.cwd();
    const packagePath = path.join(baseDir, 'package.json');

    let packageJson: any;

    if (!fs.existsSync(packagePath)) {
      this.logger.warn('package.json not found, creating one...');
      packageJson = {
        name: path.basename(baseDir),
        version: '1.0.0',
        description: 'ANDB database migration project',
        scripts: {},
        dependencies: {},
      };
    } else {
      packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }

    const scripts = this.generateScripts(envs, compareEnvs, migrateEnvs);

    // Merge existing scripts with new generated ones
    packageJson.scripts = {
      ...packageJson.scripts,
      ...scripts,
    };

    // Add standard scripts
    packageJson.scripts['generate'] = 'andb generate';

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    this.logger.log('✅ Package.json scripts updated successfully!');
  }

  private generateScripts(envs: string[], compareEnvs: string[], _migrateEnvs: string[]) {
    const scripts: Record<string, string> = {};

    // Export Scripts
    envs.forEach((env) => {
      this.DDL_TYPES.forEach((type) => {
        // Example: andb export -t DEV
        // Wait, legacy mapping: `andb export ${DDL_MAPPING[type]} ${env}`
        // My CLI uses subcommands? `andb export -t ...`
        // Need to ensure the main CLI supports these flags.
        // Right now Main CLI is `andb generate`.
        // I need to implement `ExportCommand` later.
        // For now assume `andb` binary maps to `node dist/src/cli/main.js` which has `export` command.

        if (this.DDL_MAPPING[type]) {
          const flag = this.DDL_MAPPING[type];
          scripts[`export:${env.toLowerCase()}:${type}`] = `andb export ${flag} ${env}`;
        }
      });
      // const allFlags = this.DDL_TYPES.map((t) => this.DDL_MAPPING[t])
      //   .filter(Boolean)
      //   .join(' ');
      // Or separate commands
      // Legacy: `npm run export:dev:tbl && npm run export:dev:sp ...`
      // Let's stick to legacy behavior of chaining npm runs for granular control.
      const chain = this.DDL_TYPES.filter((t) => this.DDL_MAPPING[t])
        .map((t) => `npm run export:${env.toLowerCase()}:${t}`)
        .join(' && ');
      scripts[`export:${env.toLowerCase()}`] = chain;
    });

    // Compare Scripts
    compareEnvs.forEach((env) => {
      this.DDL_TYPES.forEach((type) => {
        if (this.DDL_MAPPING[type]) {
          scripts[`compare:${env.toLowerCase()}:${type}`] =
            `andb compare ${this.DDL_MAPPING[type]} ${env}`;
        }
      });

      scripts[`compare:${env.toLowerCase()}:report`] = `andb compare -r ${env}`;

      const chain = [
        ...this.DDL_TYPES.filter((t) => this.DDL_MAPPING[t]).map(
          (t) => `npm run compare:${env.toLowerCase()}:${t}`,
        ),
        `npm run compare:${env.toLowerCase()}:report`,
      ].join(' && ');

      scripts[`compare:${env.toLowerCase()}:off`] = chain;

      // Pipeline
      if (env === 'DEV') {
        scripts[`compare:${env.toLowerCase()}`] =
          `npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
      } else {
        const prevEnv = this.getPreviousEnv(env, envs);
        scripts[`compare:${env.toLowerCase()}`] =
          `npm run export:${prevEnv.toLowerCase()} && npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
      }
    });

    // Migrate Scripts
    // Legacy logic: migrate:new:tbl, migrate:update:tbl
    // For now I skip deep implementation of migrate strings until `MigrateCommand` is fully spec'd.
    // But will stub them to match legacy.

    return scripts;
  }

  private getPreviousEnv(env: string, allEnvs: string[]): string {
    const idx = allEnvs.indexOf(env);
    return idx > 0 ? allEnvs[idx - 1] : 'DEV';
  }
}
