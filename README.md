# @andb/cli

Command-line interface for ANDB - Database Migration & Comparison Tool

> **Thin wrapper** around [@andb/core](https://www.npmjs.com/package/@andb/core) - provides `andb` command with interactive setup, script generation, and workflow automation.

[![npm](https://img.shields.io/npm/v/@andb/cli.svg)](https://www.npmjs.com/package/@andb/cli)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Install

```bash
npm install -g @andb/cli
```

---

## Quick Start

### 1. Initialize

Run interactive setup to create configuration:

```bash
cd your-project
andb init
```

_Follow the prompts to configure your environments (DEV, STAGE, PROD...) and database credentials._

### 2. Generate Scripts

Auto-generate npm scripts for your workflow:

```bash
andb generate
```

This updates your `package.json` with ready-to-use commands.

### 3. Use

Now use standard npm commands to manage your database:

```bash
# Export schema from DEV
npm run export:dev

# Compare STAGE with previous environment (DEV)
npm run compare:stage

# Deploy changes to PROD
npm run migrate:prod
```

That's it! 🚀

---

## Configuration

`andb init` creates `andb.yaml`. You can edit it manually:

```yaml
# andb.yaml
environments:
  DEV:
    host: localhost
    database: dev_db
    user: dev_user
    password: dev_pass

  PROD:
    host: prod-server.com
    database: prod_db
    user: prod_user
    password: prod_pass

# Migration Flow
order:
  - DEV
  - PROD
```

---

## Commands

### Core CLI

If you prefer raw CLI commands over npm scripts:

```bash
# Export
andb export -t DEV          # Tables
andb export -f DEV          # Functions

# Compare
andb compare -t STAGE       # Compare tables
andb compare -r STAGE       # Generate report

# Migrate
andb migrate:new -t STAGE   # New objects
andb deprecate -f STAGE     # Remove deprecated
```

### Script Generator

```bash
andb generate               # Generate all scripts
andb generate -e "DEV,PROD" # Specific environments
```

### Helpers

```bash
andb helper                 # Show all available commands
andb helper --list          # List generated npm scripts
```

---

## Workflows

### Standard Deployment (DEV → STAGE → PROD)

1. **Develop** changes in DEV
2. **Export** DEV schema:
   ```bash
   npm run export:dev
   ```
3. **Compare** with STAGE to verify changes:
   ```bash
   npm run compare:stage
   ```
4. **Deploy** to STAGE:
   ```bash
   npm run migrate:stage
   ```
5. **Repeat** for PROD:
   ```bash
   npm run compare:prod
   npm run migrate:prod
   ```

---

## Troubleshooting

- **`andb: command not found`**: Run `npm install -g @andb/cli`
- **`andb.yaml not found`**: Run `andb init`
- **Connection errors**: Check credentials in `andb.yaml`

---

## Support

- **Issues:** [github.com/The-Andb/andb-cli/issues](https://github.com/The-Andb/andb-cli/issues)
- **Core Package:** [@andb/core](https://www.npmjs.com/package/@andb/core)

---

**MIT © The Andb**
