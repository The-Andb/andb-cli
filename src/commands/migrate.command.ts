const { getLogger } = require('andb-logger');
import { Command } from 'commander';
import { CoreBridge } from '@the-andb/core';
import { CliStorageStrategy } from '../storage/strategy/cli-storage.strategy';
import * as readline from 'readline';

const logger = getLogger({ logName: 'MigrateCommand' });

function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export function register(program: Command) {
  program
    .command('migrate')
    .description('Migrate schema changes from source to destination')
    .argument('[src]', 'Source environment')
    .argument('[dest]', 'Destination environment')
    .option('-s, --source <source>', 'Source environment')
    .option('-d, --dest <dest>', 'Destination environment')
    .option('-f, --force', 'Execute without confirmation')
    .option('--auto-backup [boolean]', 'Enable/disable auto-backup')
    .option('--dry-run', 'Preview migration with Safety Report without applying changes')
    .action(async (srcArg: string, destArg: string, options: any) => {
      const sourceEnv = options.source || srcArg;
      const destEnv = options.dest || destArg;

      if (!sourceEnv || !destEnv) {
        logger.error('Source and Destination environments are required. Usage: andb migrate <src> <dest>');
        return;
      }

      try {
        const strategy = new CliStorageStrategy();
        const container = await CoreBridge.init(process.cwd(), '', strategy);
        const comparator = container.comparator;
        const migrator = container.migrator;
        const driverFactory = container.driverFactory;
        const configService = container.config;
        const orchestration = container.orchestrator;

        if (options.autoBackup !== undefined) {
          (configService as any).setAutoBackup(options.autoBackup !== 'false');
        }

        logger.info(`Analyzing migration: ${sourceEnv} -> ${destEnv}`);

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
          process.exitCode = 1;
          return;
        }

        try {
          await destDriver.connect();
        } catch (err: any) {
          logger.error(`Destination connection failed (${destEnv}): ${err.message}`);
          await srcDriver.disconnect();
          process.exitCode = 1;
          return;
        }

        try {
          const srcIntro = srcDriver.getIntrospectionService();
          const destIntro = destDriver.getIntrospectionService();
          const dbName = srcConn.config.database || 'default';

          const diff = await comparator.compareSchema(srcIntro, destIntro, dbName);

          if (diff.summary.totalChanges === 0) {
            logger.info('✅ No changes detected. Destination is already up to date.');
            process.exitCode = 0;
            return;
          }

          const objectsToMigrate: any[] = [];
          const migratorDriver = destDriver.getMigrator();

          // 1. Tables (Updated or New)
          for (const name in diff.tables) {
            const tableDiff = diff.tables[name];
            const ddl = migrator.generateAlterSQL(tableDiff, migratorDriver);
            const destDDL = await destIntro.getTableDDL(destConn.config.database || 'default', name);
            const status = destDDL ? 'UPDATED' : 'NEW';

            objectsToMigrate.push({ type: 'TABLES', name, status, ddl });
          }

          // 2. Dropped Tables
          for (const name of diff.droppedTables) {
            objectsToMigrate.push({
              type: 'TABLES',
              name,
              status: 'DEPRECATED',
              ddl: [`DROP TABLE IF EXISTS \`${name}\`;`],
            });
          }

          // 3. Other Objects
          for (const obj of diff.objects) {
            objectsToMigrate.push({
              type: obj.type + 'S',
              name: obj.name,
              status: obj.operation === 'DROP' ? 'DEPRECATED' : obj.operation === 'CREATE' ? 'NEW' : 'UPDATED',
              ddl: migrator.generateObjectSQL(obj, migratorDriver),
            });
          }

          // Safety Report
          const allStatements = objectsToMigrate.flatMap((obj: any) =>
            Array.isArray(obj.ddl) ? obj.ddl : (obj.ddl ? [obj.ddl] : [])
          );
          const safetyReport = await migrator.getSafetyReport(allStatements);

          console.error('\n--- Planned Changes ---');
          console.error(JSON.stringify(diff.summary, null, 2));

          // Safety Summary
          console.error(`\n--- Safety Report [${safetyReport.level}] ---`);
          if (safetyReport.summary.critical.length > 0) {
            console.error(`  🔴 CRITICAL: ${safetyReport.summary.critical.length} statement(s)`);
            safetyReport.summary.critical.forEach((s: string) => console.error(`     ${s.substring(0, 80)}`));
          }
          if (safetyReport.summary.warning.length > 0) {
            console.warn(`  🟡 WARNING:  ${safetyReport.summary.warning.length} statement(s)`);
            safetyReport.summary.warning.forEach((s: string) => console.error(`     ${s.substring(0, 80)}`));
          }
          console.error(`  🟢 SAFE:     ${safetyReport.summary.safe.length} statement(s)`);

          console.error('\n--- Object List ---');
          objectsToMigrate.forEach((obj) =>
            console.error(`- [${obj.type}] ${obj.name.padEnd(30)} | ${obj.status}`),
          );

          // Dry-run mode: show report and exit
          if (options.dryRun) {
            logger.info('🔍 DRY RUN complete. No changes applied.');
            process.exitCode = safetyReport.hasDestructive ? 2 : 1;
            return;
          }

          // Set exit code based on safety level
          const exitCode = safetyReport.hasDestructive ? 2 : 1;

          if (options.force) {
            await executeWithOrchestrator(orchestration, sourceEnv, destEnv, objectsToMigrate, options.force);
          } else {
            const confirmed = await askConfirmation('\nDo you want to execute these changes? (y/N): ');
            if (confirmed) {
              await executeWithOrchestrator(orchestration, sourceEnv, destEnv, objectsToMigrate, options.force);
            } else {
              logger.warn('Migration aborted by user.');
              process.exitCode = exitCode;
            }
          }
        } finally {
          await srcDriver.disconnect();
          await destDriver.disconnect();
        }
      } catch (error: any) {
        logger.error(`Migration failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
}

async function executeWithOrchestrator(orchestrator: any, srcEnv: string, destEnv: string, objects: any[], force?: boolean) {
  logger.info('Executing migration via Orchestrator...');
  const result = await orchestrator.execute('migrate', {
    srcEnv,
    destEnv,
    objects,
    force,
  });

  if (result.success) {
    logger.info(`🚀 Migration completed! ${result.successful.length} objects applied successfully.`);
    if (result.failed.length > 0) {
      logger.error(`❌ ${result.failed.length} objects failed to apply.`);
      result.failed.forEach((f: any) => logger.error(`  - ${f.name}: ${f.error}`));
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } else {
    logger.error('❌ Migration orchestration failed.');
    process.exitCode = 1;
  }
}
