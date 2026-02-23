import { Command, CommandRunner, Option } from 'nest-commander';
import { ComparatorService } from '@the-andb/core';
import { DriverFactoryService } from '@the-andb/core';
import { ProjectConfigService } from '@the-andb/core';
import { MigratorService } from '@the-andb/core';
import { Logger } from '@nestjs/common';
import * as readline from 'readline';

interface MigrateCommandOptions {
  source?: string;
  dest?: string;
  force?: boolean;
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
        await destDriver.connect();

        const diff = await this.comparator.compareSchema(
          srcDriver.getIntrospectionService(),
          destDriver.getIntrospectionService(),
          srcConn.config.database || 'default',
        );

        if (diff.summary.totalChanges === 0) {
          this.logger.log('✅ No changes detected. Destination is already up to date.');
          return;
        }

        const sqlStatements = this.migrator.generateSchemaSQL(diff);

        console.log('\n--- Planned Changes ---');
        console.table(diff.summary);
        console.log('\n--- SQL Statements ---');
        sqlStatements.forEach((sql) => console.log(sql));

        if (options?.force) {
          await this._execute(destDriver, sqlStatements);
        } else {
          const confirmed = await this._askConfirmation(
            '\nDo you want to execute these changes? (y/N): ',
          );
          if (confirmed) {
            await this._execute(destDriver, sqlStatements);
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

  private async _execute(driver: any, statements: string[]) {
    this.logger.log('Executing migration...');
    for (const sql of statements) {
      try {
        await driver.query(sql);
      } catch (err: any) {
        this.logger.error(`Failed to execute: ${sql}`);
        this.logger.error(`Error: ${err.message}`);
        // Optionally break or continue based on config
        const continueOnErr = await this._askConfirmation(
          'Operation failed. Continue anyway? (y/N): ',
        );
        if (!continueOnErr) throw new Error('Migration failed at point of execution');
      }
    }
    this.logger.log('🚀 Migration completed successfully!');
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
}
