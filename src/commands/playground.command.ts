import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import {
  ParserService,
  ComparatorService,
  MigratorService,
  MysqlMigrator,
} from '@the-andb/core';
import * as yaml from 'js-yaml';

interface PlaygroundOptions {
  source?: string;
  target?: string;
  format?: 'text' | 'json' | 'yaml';
}

@Injectable()
@Command({
  name: 'playground',
  description: 'Test andb-core semantic diffing by comparing two local SQL files',
})
export class PlaygroundCommand extends CommandRunner {
  private readonly logger = new Logger(PlaygroundCommand.name);

  constructor(
    private readonly parser: ParserService,
    private readonly comparator: ComparatorService,
    private readonly migrator: MigratorService,
  ) {
    super();
  }

  async run(
    passedParam: string[],
    options: PlaygroundOptions,
  ): Promise<void> {
    if (!options.source || !options.target) {
      this.logger.error('Both --source and --target files are required.');
      process.exit(1);
    }

    try {
      const srcDDL = fs.readFileSync(options.source, 'utf-8');
      const targetDDL = fs.readFileSync(options.target, 'utf-8');

      const format = options.format || 'text';
      const isMachineReadable = format === 'json' || format === 'yaml';

      if (!isMachineReadable) {
        this.logger.log(`Comparing ${options.source} against ${options.target}...`);
      }

      const srcTable = this.parser.parseTable(srcDDL);
      const destTable = this.parser.parseTable(targetDDL);

      if (!isMachineReadable) {
        this.logger.log('--- Parsed Current Schema Table (Target) ---');
        console.log(JSON.stringify(srcTable, null, 2));

        this.logger.log('--- Parsed Desired Schema Table (Source) ---');
        console.log(JSON.stringify(destTable, null, 2));
      }

      // Note: Comparator Service compares: Desired vs Current.
      // So Desired = target.sql (dest), Current = source.sql (src)
      const diffOps = this.comparator.compareTables(targetDDL, srcDDL);

      // Playground is offline and has no driver, so we default to standard MySQL syntax
      // In the future, PlaygroundCommand could take a `--dialect postgres` flag to initialize the specific Migrator
      const defaultMigrator = new MysqlMigrator();
      const sqls = this.migrator.generateAlterSQL(diffOps, defaultMigrator);

      // Exit codes logic
      let exitCode = 0;
      let hasDestructive = false;

      if (diffOps.hasChanges && sqls.length > 0) {
        hasDestructive = diffOps.operations.some((op: any) => op.type === 'DROP');
        exitCode = hasDestructive ? 2 : 1;
      }

      if (isMachineReadable) {
        const output = {
          hasChanges: diffOps.hasChanges,
          destructive: hasDestructive,
          operations: diffOps.operations,
          sqls,
          exitCode,
        };

        if (format === 'json') {
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else {
          process.stdout.write(yaml.dump(output) + '\n');
        }
      } else {
        this.logger.log('--- Diff Operations ---');
        console.log(JSON.stringify(diffOps, null, 2));

        this.logger.log('--- Generated ALTER TABLE SQL ---');
        if (sqls.length > 0) {
          sqls.forEach((sql) => console.log(sql));
        } else {
          console.log('✅ Tables are structurally identical.');
        }
      }

      if (exitCode === 2) {
        // Always warn about destructive changes to stderr
        console.error('\n⚠️  DESTRUCTIVE CHANGES DETECTED: This transformation includes DROP operations.');
      }

      process.exitCode = exitCode;
    } catch (error: any) {
      this.logger.error(`Playground execution failed: ${error.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '-s, --source [path]',
    description: 'Path to the source SQL file (e.g., current schema)',
  })
  parseSource(val: string): string {
    return val;
  }

  @Option({
    flags: '-t, --target [path]',
    description: 'Path to the target SQL file (e.g., desired schema)',
  })
  parseTarget(val: string): string {
    return val;
  }

  @Option({
    flags: '-f, --format [type]',
    description: 'Output format (text, json, yaml)',
    defaultValue: 'text',
  })
  parseFormat(val: string): string {
    return val;
  }
}
