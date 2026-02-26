import { Command, CommandRunner, Option } from 'nest-commander';
import {
  ComparatorService,
  DriverFactoryService,
  ProjectConfigService,
  MigratorService,
  OrchestrationService,
  ANDB_ORCHESTRATOR
} from '@the-andb/core';
import { Logger, Inject } from '@nestjs/common';
import * as readline from 'readline';

interface MigrateCommandOptions {
  source?: string;
  dest?: string;
  force?: boolean;
  autoBackup?: boolean;
}

@Command({
  name: 'migrate',
  description: 'Migrate schema changes from source to destination',
})
export class MigrateCommand extends CommandRunner {
  private readonly logger = new Logger(MigrateCommand.name);

  constructor(
    private readonly comparator: ComparatorService,
    private readonly migrator: MigratorService,
    private readonly driverFactory: DriverFactoryService,
    private readonly configService: ProjectConfigService,
    @Inject(ANDB_ORCHESTRATOR) private readonly orchestrator: OrchestrationService,
  ) {
    super();
  }

  async run(passedParam: string[], options?: MigrateCommandOptions): Promise<void> {
    const sourceEnv = options?.source || passedParam[0];
    const destEnv = options?.dest || passedParam[1];

    if (!sourceEnv || !destEnv) {
      this.logger.error(
        'Source and Destination environments are required. Usage: andb migrate <src> <dest>',
      );
      return;
    }

    try {
      if (options?.autoBackup !== undefined) {
        (this.configService as any).setAutoBackup(options.autoBackup);
      }

      this.logger.log(`Analyzing migration: ${sourceEnv} -> ${destEnv}`);

      const srcConn = this.configService.getConnection(sourceEnv);
      const destConn = this.configService.getConnection(destEnv);

      if (!srcConn || !destConn) {
        throw new Error('Could not find connection config for one or both environments');
      }

      const srcDriver = await this.driverFactory.create(srcConn.type, srcConn.config);
      const destDriver = await this.driverFactory.create(destConn.type, destConn.config);

      try {
        await srcDriver.connect();
      } catch (err: any) {
        this.logger.error(`Source connection failed (${sourceEnv}): ${err.message}`);
        process.exitCode = 1;
        return;
      }

      try {
        await destDriver.connect();
      } catch (err: any) {
        this.logger.error(`Destination connection failed (${destEnv}): ${err.message}`);
        await srcDriver.disconnect();
        process.exitCode = 1;
        return;
      }

      try {
        const srcIntro = srcDriver.getIntrospectionService();
        const destIntro = destDriver.getIntrospectionService();
        const dbName = srcConn.config.database || 'default';
        const destDbName = destConn.config.database || 'default';

        const diff = await this.comparator.compareSchema(srcIntro, destIntro, dbName);

        if (diff.summary.totalChanges === 0) {
          this.logger.log('✅ No changes detected. Destination is already up to date.');
          return;
        }

        const objectsToMigrate: any[] = [];
        let hasDestructive = false;

        // 1. Tables (Updated or New)
        const migrator = destDriver.getMigrator();

        for (const name in diff.tables) {
          const tableDiff = diff.tables[name];
          const ddl = this.migrator.generateAlterSQL(tableDiff, migrator);
          const destDDL = await destIntro.getTableDDL(destDbName, name);
          const status = destDDL ? 'UPDATED' : 'NEW';

          if (tableDiff.operations.some((op) => op.type === 'DROP')) {
            hasDestructive = true;
          }

          objectsToMigrate.push({
            type: 'TABLES',
            name,
            status,
            ddl,
          });
        }

        // 2. Dropped Tables
        for (const name of diff.droppedTables) {
          hasDestructive = true;
          objectsToMigrate.push({
            type: 'TABLES',
            name,
            status: 'DEPRECATED',
            ddl: [`DROP TABLE IF EXISTS \`${name}\`;`],
          });
        }

        // 3. Other Objects
        for (const obj of diff.objects) {
          if (obj.operation === 'DROP') {
            hasDestructive = true;
          }
          objectsToMigrate.push({
            type: obj.type + 'S',
            name: obj.name,
            status:
              obj.operation === 'DROP' ? 'DEPRECATED' : obj.operation === 'CREATE' ? 'NEW' : 'UPDATED',
            ddl: this.migrator.generateObjectSQL(obj, migrator),
          });
        }

        console.log('\n--- Planned Changes ---');
        console.table(diff.summary);

        if (hasDestructive) {
          console.error(
            '\n⚠️  DESTRICTIVE CHANGES DETECTED: This migration includes DROP operations.',
          );
        }

        console.log('\n--- Object List ---');
        objectsToMigrate.forEach((obj) =>
          console.log(`- [${obj.type}] ${obj.name.padEnd(30)} | ${obj.status}`),
        );

        if (options?.force) {
          await this._executeWithOrchestrator(sourceEnv, destEnv, objectsToMigrate);
        } else {
          const confirmed = await this._askConfirmation(
            '\nDo you want to execute these changes? (y/N): ',
          );
          if (confirmed) {
            await this._executeWithOrchestrator(sourceEnv, destEnv, objectsToMigrate);
          } else {
            this.logger.warn('Migration aborted by user.');
          }
        }
      } finally {
        await srcDriver.disconnect();
        await destDriver.disconnect();
      }
    } catch (error: any) {
      this.logger.error(`Migration failed: ${error.message}`);
    }
  }

  private async _executeWithOrchestrator(srcEnv: string, destEnv: string, objects: any[]) {
    this.logger.log('Executing migration via Orchestrator...');
    const result = await this.orchestrator.execute('migrate', {
      srcEnv,
      destEnv,
      objects,
    });

    if (result.success) {
      this.logger.log(
        `🚀 Migration completed! ${result.successful.length} objects applied successfully.`,
      );
      if (result.failed.length > 0) {
        this.logger.error(`❌ ${result.failed.length} objects failed to apply.`);
        result.failed.forEach((f: any) => this.logger.error(`  - ${f.name}: ${f.error}`));
      }
    } else {
      this.logger.error('❌ Migration orchestration failed.');
    }
  }

  private _askConfirmation(query: string): Promise<boolean> {
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

  @Option({
    flags: '-s, --source <source>',
    description: 'Source environment',
  })
  parseSource(val: string): string {
    return val;
  }

  @Option({
    flags: '-d, --dest <dest>',
    description: 'Destination environment',
  })
  parseDest(val: string): string {
    return val;
  }

  @Option({
    flags: '-f, --force',
    description: 'Execute without confirmation',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--auto-backup [boolean]',
    description: 'Enable/disable auto-backup before migration (default: true)',
  })
  parseAutoBackup(val: string): boolean {
    return val !== 'false';
  }
}
