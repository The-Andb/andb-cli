import { Command } from 'commander';

jest.mock('@the-andb/core', () => ({
  CoreBridge: { init: jest.fn() },
  BaseStorageStrategy: class {},
}));

import { register } from '../migrate.command';
import { CoreBridge } from '@the-andb/core';

function buildContainer(diff: any, executeResult?: any) {
  const migratorDriver = {};
  const driver = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getIntrospectionService: jest.fn().mockReturnValue({
      getTableDDL: jest.fn().mockResolvedValue(null),
    }),
    getMigrator: jest.fn().mockReturnValue(migratorDriver),
  };
  return {
    comparator: { compareSchema: jest.fn().mockResolvedValue(diff) },
    migrator: {
      generateAlterSQL: jest.fn().mockReturnValue(['ALTER TABLE foo ADD COLUMN bar INT;']),
      generateObjectSQL: jest.fn().mockReturnValue(['CREATE PROCEDURE p1() BEGIN END;']),
      getSafetyReport: jest.fn().mockResolvedValue({
        level: 'SAFE',
        hasDestructive: false,
        summary: { safe: ['ALTER TABLE foo ADD COLUMN bar INT;'], warning: [], critical: [] },
      }),
    },
    driverFactory: { create: jest.fn().mockResolvedValue(driver) },
    config: {
      getConnection: jest.fn().mockReturnValue({ type: 'mysql', config: { database: 'db' } }),
      setAutoBackup: jest.fn(),
    },
    orchestrator: { execute: jest.fn().mockResolvedValue(executeResult) },
  };
}

const NON_EMPTY_DIFF = {
  summary: { totalChanges: 1, tablesChanged: 1, objectsChanged: 0 },
  tables: { foo: { tableName: 'foo', operations: [{ type: 'MODIFY', target: 'COLUMN', name: 'bar' }], hasChanges: true } },
  droppedTables: [],
  objects: [],
};

describe('MigrateCommand', () => {
  let program: Command;
  let originalIsTTY: boolean | undefined;
  let originalCI: string | undefined;

  beforeEach(() => {
    program = new Command();
    register(program);
    originalIsTTY = process.stdin.isTTY;
    originalCI = process.env.CI;
    process.exitCode = undefined;
  });

  afterEach(() => {
    (process.stdin as any).isTTY = originalIsTTY;
    if (originalCI === undefined) delete process.env.CI;
    else process.env.CI = originalCI;
    jest.clearAllMocks();
  });

  it('should register the migrate command', () => {
    const cmd = program.commands.find(c => c.name() === 'migrate');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Migrate schema changes from source to destination');
  });

  it('should have required options: --source, --dest, --force, --dry-run', () => {
    const cmd = program.commands.find(c => c.name() === 'migrate')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--source');
    expect(optNames).toContain('--dest');
    expect(optNames).toContain('--force');
    expect(optNames).toContain('--dry-run');
  });

  describe('non-interactive confirmation guard (CI-hang fix)', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('fails fast instead of prompting when stdin is not a TTY and --force is absent', async () => {
      (process.stdin as any).isTTY = false;
      delete process.env.CI;
      const container = buildContainer(NON_EMPTY_DIFF);
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest']);

      expect(container.orchestrator.execute).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      const printed = [...errorSpy.mock.calls, ...logSpy.mock.calls].map(c => c.join(' ')).join('\n');
      expect(printed).toMatch(/non-interactive environment/i);
      logSpy.mockRestore();
    });

    it('fails fast when CI=true even if stdin looks like a TTY', async () => {
      (process.stdin as any).isTTY = true;
      process.env.CI = 'true';
      const container = buildContainer(NON_EMPTY_DIFF);
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest']);

      expect(container.orchestrator.execute).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('still executes when --force is passed in a non-interactive environment', async () => {
      (process.stdin as any).isTTY = false;
      delete process.env.CI;
      const container = buildContainer(NON_EMPTY_DIFF, { success: true, successful: [{ name: 'foo' }], failed: [] });
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest', '--force']);

      expect(container.orchestrator.execute).toHaveBeenCalled();
      expect(process.exitCode).toBe(0);
    });
  });

  describe('partial-failure (partiallyApplied) surfacing', () => {
    let errorSpy: jest.SpyInstance;
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
      (process.stdin as any).isTTY = true;
      delete process.env.CI;
    });

    afterEach(() => {
      errorSpy.mockRestore();
      stdoutSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('prints a distinct danger message for partiallyApplied failures (human-readable)', async () => {
      const executeResult = {
        success: false,
        successful: [],
        failed: [
          { name: 'foo', type: 'TABLES', error: 'duplicate column', statementIndex: 2, totalStatements: 3, partiallyApplied: true },
        ],
      };
      const container = buildContainer(NON_EMPTY_DIFF, executeResult);
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest', '--force']);

      const printed = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(printed).toMatch(/HALF-MIGRATED/i);
      expect(printed).toContain('2/3');
      expect(process.exitCode).toBe(1);
    });

    it('prints a "safe to retry" message for non-partiallyApplied failures', async () => {
      const executeResult = {
        success: false,
        successful: [],
        failed: [
          { name: 'foo', type: 'TABLES', error: 'connection refused', statementIndex: 0, totalStatements: 3, partiallyApplied: false },
        ],
      };
      const container = buildContainer(NON_EMPTY_DIFF, executeResult);
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest', '--force']);

      const printed = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(printed).not.toMatch(/HALF-MIGRATED/i);
      expect(printed).toMatch(/safe to retry/i);
      expect(process.exitCode).toBe(1);
    });

    it('reflects the partiallyApplied distinction in --format json output', async () => {
      const executeResult = {
        success: false,
        successful: [],
        failed: [
          { name: 'foo', type: 'TABLES', error: 'duplicate column', statementIndex: 2, totalStatements: 3, partiallyApplied: true },
          { name: 'bar', type: 'PROCEDURES', error: 'connection refused', statementIndex: 0, totalStatements: 1, partiallyApplied: false },
        ],
      };
      const container = buildContainer(NON_EMPTY_DIFF, executeResult);
      (CoreBridge.init as jest.Mock).mockResolvedValue(container);

      await program.parseAsync(['node', 'andb', 'migrate', 'src', 'dest', '--force', '--format', 'json']);

      const jsonCall = stdoutSpy.mock.calls.map(c => String(c[0])).find(s => s.trim().startsWith('{'));
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(jsonCall!);
      expect(parsed.partiallyAppliedCount).toBe(1);
      expect(parsed.notAppliedCount).toBe(1);
      expect(parsed.failed).toHaveLength(2);
    });
  });
});
