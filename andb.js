#!/usr/bin/env node

/**
 * andb-cli - Command Line Interface for andb-core
 * 
 * This is a thin wrapper around the NestJS CLI implementation in @the-andb/core
 */

require('reflect-metadata');
const { CommandFactory } = require('nest-commander');
const { CliModule } = require('./dist/cli.module');
const { Logger } = require('@nestjs/common');

async function bootstrap() {
  try {
    const customLogger = {
      log: () => { },
      error: (...args) => console.error(...args),
      warn: (...args) => console.error(...args),
      debug: () => { },
      verbose: () => { },
    };
    const isMachineReadable = process.argv.some(arg =>
      ['-f', '--format'].includes(arg) &&
      ['json', 'yaml'].includes(process.argv[process.argv.indexOf(arg) + 1])
    );

    if (isMachineReadable) {
      process.env.ANDB_QUIET = '1';
      Logger.overrideLogger(false);
    }

    // Run the NestJS CLI context
    await CommandFactory.run(CliModule, {
      logger: isMachineReadable ? customLogger : ['error', 'warn'],
      errorHandler: (err) => {
        console.error('❌ FATAL ERROR:', err.message);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Failed to bootstrap CLI:', error.message);
    process.exit(1);
  }
}

bootstrap();
