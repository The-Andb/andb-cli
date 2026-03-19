#!/usr/bin/env node

/**
 * andb-cli - Command Line Interface for andb-core
 * Lightweight, framework-free
 */

const { Command } = require('commander');
const program = new Command();

program
  .name('andb')
  .version(require('../package.json').version)
  .description('The Andb - Database Schema Migration Tool');

// ... (skipping monkey-patch for brevity in Instruction, but replacing the whole block)

// Register commands
require('./commands/init.command').register(program);
require('./commands/export.command').register(program);
require('./commands/compare.command').register(program);
require('./commands/migrate.command').register(program);
require('./commands/generate.command').register(program);
require('./commands/helper.command').register(program);
require('./commands/playground.command').register(program);
require('./commands/search.command').register(program);
require('./commands/rpc.command').register(program);

program.parse(process.argv);
