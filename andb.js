#!/usr/bin/env node

/**
 * andb-cli - Command Line Interface for andb-core
 * 
 * @author ph4n4n
 * @version 1.0.0-beta.1
 * @license MIT
 */

const path = require('path');
const fs = require('fs');

// Initialize global logger
global.logger = require('andb-logger').getInstance({
  mode: process.env.MODE || 'PROD',
  dirpath: __dirname,
  logName: 'ANDB-CLI',
});

// Check if running init command (doesn't need config)
const isInitCommand = process.argv.includes('init');

// Try to load config from YAML or JS
const yamlPath = path.resolve(process.cwd(), 'andb.yaml');
const configPath = path.resolve(process.cwd(), 'andb.config.js');
let userConfig;

if (isInitCommand) {
  // For init command, use minimal config
  userConfig = {
    ENVIRONMENTS: ['DEV', 'STAGE', 'UAT', 'PROD']
  };
} else {
  // Try YAML first, then JS
  if (fs.existsSync(yamlPath)) {
    try {
      const yaml = require('js-yaml');
      const yamlConfig = yaml.load(fs.readFileSync(yamlPath, 'utf8'));

      // Convert YAML to config format
      userConfig = {
        getDBDestination: (env) => yamlConfig.environments[env],
        getDBName: (env) => yamlConfig.environments[env]?.database,
        getSourceEnv: (destEnv) => {
          const idx = yamlConfig.order.indexOf(destEnv);
          return idx > 0 ? yamlConfig.order[idx - 1] : yamlConfig.order[0];
        },
        getDestEnv: (srcEnv) => {
          const idx = yamlConfig.order.indexOf(srcEnv);
          return idx < yamlConfig.order.length - 1 ? yamlConfig.order[idx + 1] : yamlConfig.order[yamlConfig.order.length - 1];
        },
        replaceWithEnv: (str) => str,
        ENVIRONMENTS: yamlConfig.order
      };
    } catch (error) {
      console.error('❌ Error loading andb.yaml:', error.message);
      process.exit(1);
    }
  } else if (fs.existsSync(configPath)) {
    try {
      userConfig = require(configPath);
    } catch (error) {
      console.error('❌ Error loading andb.config.js:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ Configuration not found');
    console.error('Please run: andb init');
    console.error('\nOr create andb.yaml or andb.config.js manually');
    process.exit(1);
  }
}

// Use the CLI builder from andb-core
const { buildCLI } = require('@andb/core');

const program = buildCLI({
  ...userConfig,
  baseDir: process.cwd(),
  logName: 'ANDB-CLI'
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
