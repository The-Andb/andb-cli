const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger({ logName: 'HelperCommand' });

const ENVIRONMENTS = ['LOCAL', 'DEV', 'UAT', 'STAGE', 'PROD'];
const DDL_TYPES = ['fn', 'sp', 'tbl', 'trg'];
const MIGRATE_TYPES = ['new', 'update'];

export function register(program: Command) {
  program
    .command('helper')
    .alias('help-andb')
    .description('Helper utilities and tools')
    .option('-l, --list', 'List available helpers')
    .option('-c, --config', 'Show current configuration')
    .action(async (options: any) => {
      if (options.list) {
        listScripts();
      } else if (options.config) {
        showConfiguration();
      } else {
        showUsage();
      }
    });
}

function showUsage() {
  console.log(`
🔧 ANDB Script Helper
=====================

📋 Available Commands:
---------------------

1. Export Commands:
   npm run export:{env}:{type}     # Export specific DDL type
   npm run export:{env}            # Export all DDL types

   Examples:
   npm run export:dev:fn          # Export functions from DEV
   npm run export:uat:sp          # Export procedures from UAT
   npm run export:stage           # Export all from STAGE

2. Compare Commands:
   npm run compare:{env}:{type}   # Compare specific DDL type
   npm run compare:{env}:report   # Generate comparison report
   npm run compare:{env}:off      # Compare all + report
   npm run compare:{env}          # Export + Compare with previous env
   npm run compare:{env}:migrated # Compare after migration

   Examples:
   npm run compare:uat:fn         # Compare functions in UAT
   npm run compare:stage:report   # Generate STAGE report
   npm run compare:prod           # Full PROD comparison

3. Migrate Commands:
   npm run migrate:{env}:{type}:{ddl}  # Migrate specific DDL
   npm run migrate:{env}:{type}        # Migrate all DDL by type
   npm run migrate:{env}               # Full migration workflow

   Examples:
   npm run migrate:uat:new:fn     # Migrate new functions to UAT
   npm run migrate:stage:update   # Update all DDL in STAGE
   npm run migrate:prod           # Full PROD migration

📊 Environments: ${ENVIRONMENTS.join(', ')}
🔧 DDL Types: ${DDL_TYPES.join(', ')}
🔄 Migrate Types: ${MIGRATE_TYPES.join(', ')}

💡 Quick Examples:
-----------------
npm run export:dev               # Export all from DEV
npm run compare:uat              # Compare UAT with DEV
npm run migrate:stage            # Migrate STAGE from UAT

🛠️  Utility Commands:
---------------------
npm run generate                 # Regenerate all scripts
npm run helper                   # Show this help
npm run helper --list            # List all available scripts
npm run helper --config          # Show current configuration

📝 Notes:
---------
- {env} = local, dev, uat, stage, prod
- {type} = fn, sp, tbl, trg
- {ddl} = fn, sp, tbl, trg
`);
}

function showConfiguration() {
  console.log(`
⚙️ ANDB Configuration
=====================

📋 Current Environment Configuration:
------------------------------------

🌍 Environment Variables:
${process.env.ANDB_ENVIRONMENTS
      ? `
  ANDB_ENVIRONMENTS: ${process.env.ANDB_ENVIRONMENTS}
`
      : '  ANDB_ENVIRONMENTS: Not set'
    }
${process.env.ANDB_COMPARE_ENVIRONMENTS
      ? `
  ANDB_COMPARE_ENVIRONMENTS: ${process.env.ANDB_COMPARE_ENVIRONMENTS}
`
      : '  ANDB_COMPARE_ENVIRONMENTS: Not set'
    }
${process.env.ANDB_MIGRATE_ENVIRONMENTS
      ? `
  ANDB_MIGRATE_ENVIRONMENTS: ${process.env.ANDB_MIGRATE_ENVIRONMENTS}
`
      : '  ANDB_MIGRATE_ENVIRONMENTS: Not set'
    }

📊 Default Configuration:
  All Environments: ${ENVIRONMENTS.join(', ')}
  Compare Environments: ${ENVIRONMENTS.filter((env) => env !== 'LOCAL').join(', ')}
  Migrate Environments: ${ENVIRONMENTS.filter((env) => !['LOCAL', 'DEV'].includes(env)).join(', ')}

💡 Configuration Priority:
  1. CLI Options (highest priority)
  2. Environment Variables
  3. Default Values (lowest priority)
`);
}

function listScripts() {
  const baseDir = process.cwd();
  const packagePath = path.join(baseDir, 'package.json');

  if (!fs.existsSync(packagePath)) {
    logger.error(`Package.json not found at: ${packagePath}`);
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = packageJson.scripts || {};

  const categories: Record<string, string[]> = {
    export: [],
    compare: [],
    migrate: [],
    deprecate: [],
    utility: [],
  };

  Object.keys(scripts).forEach((script) => {
    if (script.startsWith('export:')) {
      categories.export.push(script);
    } else if (script.startsWith('compare:')) {
      categories.compare.push(script);
    } else if (script.startsWith('migrate:')) {
      categories.migrate.push(script);
    } else if (script.startsWith('deprecate:') || script.startsWith('dep:')) {
      categories.deprecate.push(script);
    } else {
      categories.utility.push(script);
    }
  });

  console.log('\n📋 All Available Scripts:');
  console.log('==========================\n');

  Object.entries(categories).forEach(([category, scriptList]) => {
    if (scriptList.length > 0) {
      console.log(`\n${category.toUpperCase()} (${scriptList.length}):`);
      console.log('-'.repeat(category.length + 3));
      scriptList.forEach((script) => {
        console.log(`  ${script}`);
      });
    }
  });
}
