import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import {
  ParserService,
  ComparatorService,
  MigratorService,
} from '@the-andb/core';

interface PlaygroundOptions {
  source?: string;
  target?: string;
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

      this.logger.log(`Comparing ${options.source} against ${options.target}...`);

      const srcTable = this.parser.parseTable(srcDDL);
      const destTable = this.parser.parseTable(targetDDL);

      this.logger.log('--- Parsed Current Schema Table (Target) ---');
      console.log(JSON.stringify(srcTable, null, 2));

      this.logger.log('--- Parsed Desired Schema Table (Source) ---');
      console.log(JSON.stringify(destTable, null, 2));

      // Note: Comparator Service compares: Desired vs Current.
      // So Desired = target.sql (dest), Current = source.sql (src)
      const diffOps = this.comparator.compareTables(targetDDL, srcDDL);

      this.logger.log('--- Diff Operations ---');
      console.log(JSON.stringify(diffOps, null, 2));

      this.logger.log('--- Generated ALTER TABLE SQL ---');
      const sqls = this.migrator.generateAlterSQL(diffOps);
      sqls.forEach(sql => console.log(sql));

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
}
