#!/usr/bin/env node

/**
 * andb-cli - Command Line Interface for andb-core
 * Lightweight, framework-free
 */

const { Command } = require('commander');
const program = new Command();

program
  .name('andb')
  .version(require('./package.json').version)
  .description('The Andb - Database Schema Migration Tool');

// Register commands
require('./dist/commands/init.command').register(program);
require('./dist/commands/export.command').register(program);
require('./dist/commands/compare.command').register(program);
require('./dist/commands/migrate.command').register(program);
require('./dist/commands/generate.command').register(program);
require('./dist/commands/helper.command').register(program);
require('./dist/commands/playground.command').register(program);

program.parse(process.argv);
