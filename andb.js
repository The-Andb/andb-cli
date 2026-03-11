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

// Monkey-patch andb-logger for clean CLI output
const { getLogger } = require('andb-logger');
const dummyLogger = getLogger();
const LoggerProto = Object.getPrototypeOf(dummyLogger);

// 1. Simplify log prefix: remove timestamp and service name
LoggerProto.logStructured = function (level) {
  return `${this.icons[level]}`;
};

// 2. Redirect info/warn/error/dev to stderr (keeps stdout clean for data/JSON pipes)
['info', 'warn', 'error', 'dev'].forEach((level) => {
  const original = LoggerProto[level];
  if (original) {
    LoggerProto[level] = function (...args) {
      const oldLog = console.log;
      console.log = console.error;
      original.apply(this, args);
      console.log = oldLog;
    };
  }
});

// Register commands
require('./dist/commands/init.command').register(program);
require('./dist/commands/export.command').register(program);
require('./dist/commands/compare.command').register(program);
require('./dist/commands/migrate.command').register(program);
require('./dist/commands/generate.command').register(program);
require('./dist/commands/helper.command').register(program);
require('./dist/commands/playground.command').register(program);
require('./dist/commands/search.command').register(program);

program.parse(process.argv);
