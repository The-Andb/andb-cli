const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger({ logName: 'GenerateCommand' });

const DDL_TYPES = ['fn', 'sp', 'tbl', 'trg', 'views', 'events'];
const DDL_MAPPING: Record<string, string> = {
  fn: '-f',
  sp: '-p',
  tbl: '-t',
  trg: '-tr',
  views: '-v',
  events: '-e',
};

export function register(program: Command) {
  program
    .command('generate')
    .alias('gen')
    .description('Generate scripts and utilities for package.json')
    .option('-e, --environments <list>', 'Comma-separated list of environments')
    .option('-c, --compare-envs <list>', 'Comma-separated list of environments for comparison')
    .option('-m, --migrate-envs <list>', 'Comma-separated list of environments for migration')
    .action(async (options: any) => {
      const envs = getEnvironments(options.environments);
      const compareEnvs = getCompareEnvironments(options.compareEnvs, envs);
      const migrateEnvs = getMigrateEnvironments(options.migrateEnvs, envs);

      logger.info(`Environments: ${envs.join(', ')}`);
      updatePackageJson(envs, compareEnvs, migrateEnvs);
    });
}

function getEnvironments(optionEnv?: string): string[] {
  if (optionEnv) {
    return optionEnv.split(',').map((e) => e.trim().toUpperCase());
  }
  return ['LOCAL', 'DEV', 'UAT', 'STAGE', 'PROD'];
}

function getCompareEnvironments(optionEnv: string | undefined, allEnvs: string[]): string[] {
  if (optionEnv) return optionEnv.split(',').map((e) => e.trim().toUpperCase());
  return allEnvs.filter((env) => env !== 'LOCAL');
}

function getMigrateEnvironments(optionEnv: string | undefined, allEnvs: string[]): string[] {
  if (optionEnv) return optionEnv.split(',').map((e) => e.trim().toUpperCase());
  return allEnvs.filter((env) => !['LOCAL', 'DEV'].includes(env));
}

function updatePackageJson(envs: string[], compareEnvs: string[], migrateEnvs: string[]) {
  const baseDir = process.cwd();
  const packagePath = path.join(baseDir, 'package.json');

  let packageJson: any;

  if (!fs.existsSync(packagePath)) {
    logger.warn('package.json not found, creating one...');
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

  const scripts = generateScripts(envs, compareEnvs, migrateEnvs);

  packageJson.scripts = {
    ...packageJson.scripts,
    ...scripts,
  };

  packageJson.scripts['generate'] = 'andb generate';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  logger.info('✅ Package.json scripts updated successfully!');
}

function generateScripts(envs: string[], compareEnvs: string[], _migrateEnvs: string[]) {
  const scripts: Record<string, string> = {};

  envs.forEach((env) => {
    DDL_TYPES.forEach((type) => {
      if (DDL_MAPPING[type]) {
        const flag = DDL_MAPPING[type];
        scripts[`export:${env.toLowerCase()}:${type}`] = `andb export ${flag} ${env}`;
      }
    });
    const chain = DDL_TYPES.filter((t) => DDL_MAPPING[t])
      .map((t) => `npm run export:${env.toLowerCase()}:${t}`)
      .join(' && ');
    scripts[`export:${env.toLowerCase()}`] = chain;
  });

  compareEnvs.forEach((env) => {
    DDL_TYPES.forEach((type) => {
      if (DDL_MAPPING[type]) {
        scripts[`compare:${env.toLowerCase()}:${type}`] =
          `andb compare ${DDL_MAPPING[type]} ${env}`;
      }
    });

    scripts[`compare:${env.toLowerCase()}:report`] = `andb compare -r ${env}`;

    const chain = [
      ...DDL_TYPES.filter((t) => DDL_MAPPING[t]).map(
        (t) => `npm run compare:${env.toLowerCase()}:${t}`,
      ),
      `npm run compare:${env.toLowerCase()}:report`,
    ].join(' && ');

    scripts[`compare:${env.toLowerCase()}:off`] = chain;

    if (env === 'DEV') {
      scripts[`compare:${env.toLowerCase()}`] =
        `npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
    } else {
      const prevEnv = getPreviousEnv(env, envs);
      scripts[`compare:${env.toLowerCase()}`] =
        `npm run export:${prevEnv.toLowerCase()} && npm run export:${env.toLowerCase()} && npm run compare:${env.toLowerCase()}:off`;
    }
  });

  return scripts;
}

function getPreviousEnv(env: string, allEnvs: string[]): string {
  const idx = allEnvs.indexOf(env);
  return idx > 0 ? allEnvs[idx - 1] : 'DEV';
}
