#!/usr/bin/env node

/**
 * andb-cli - Command Line Interface for andb-core
 * 
 * This is a thin wrapper around the NestJS CLI implementation in @the-andb/core
 */

require('reflect-metadata');
const { CommandFactory } = require('nest-commander');
const { AppModule } = require('@the-andb/core');

async function bootstrap() {
  try {
    // Run the NestJS CLI context
    await CommandFactory.run(AppModule, {
      logger: ['error', 'warn'],
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
