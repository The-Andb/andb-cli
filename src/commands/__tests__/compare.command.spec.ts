import { Command } from 'commander';

jest.mock('@the-andb/core', () => ({
  CoreBridge: { init: jest.fn() },
  BaseStorageStrategy: class {},
}));

import { register } from '../compare.command';
import { CoreBridge } from '@the-andb/core';

function buildContainer(diff: any) {
  const driver = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getIntrospectionService: jest.fn().mockReturnValue({}),
  };
  return {
    comparator: { compareSchema: jest.fn().mockResolvedValue(diff) },
    driverFactory: { create: jest.fn().mockResolvedValue(driver) },
    config: {
      getConnection: jest.fn().mockReturnValue({ type: 'mysql', config: { database: 'db' } }),
      setAutoBackup: jest.fn(),
    },
    reporter: { generateHtmlReport: jest.fn() },
  };
}

describe('CompareCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
  });

  it('should register the compare command', () => {
    const cmd = program.commands.find(c => c.name() === 'compare');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Compare two database schemas');
  });

  it('should have required options: --source, --dest, --report, --format', () => {
    const cmd = program.commands.find(c => c.name() === 'compare')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--source');
    expect(optNames).toContain('--dest');
    expect(optNames).toContain('--report');
    expect(optNames).toContain('--format');
  });

  describe('incomplete-comparison surfacing', () => {
    let errorSpy: jest.SpyInstance;
    let stdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
      process.exitCode = undefined;
    });

    afterEach(() => {
      errorSpy.mockRestore();
      stdoutSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('does NOT exit 0 when the diff has no changes but has per-item errors', async () => {
      const diff = {
        summary: { totalChanges: 0, tablesChanged: 0, objectsChanged: 0 },
        tables: {},
        droppedTables: [],
        objects: [],
        errors: [{ scope: 'table', name: 'orders', message: 'DDL fetch timed out' }],
      };
      (CoreBridge.init as jest.Mock).mockResolvedValue(buildContainer(diff));

      await program.parseAsync(['node', 'andb', 'compare', 'src', 'dest']);

      expect(process.exitCode).toBe(3);
      const printed = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(printed).toContain('orders');
      expect(printed).toContain('DDL fetch timed out');
    });

    it('exits 0 with no warning when there are no changes and no errors', async () => {
      const diff = {
        summary: { totalChanges: 0, tablesChanged: 0, objectsChanged: 0 },
        tables: {},
        droppedTables: [],
        objects: [],
      };
      (CoreBridge.init as jest.Mock).mockResolvedValue(buildContainer(diff));

      await program.parseAsync(['node', 'andb', 'compare', 'src', 'dest']);

      expect(process.exitCode).toBe(0);
    });

    it('includes errors in the JSON output and reports exitCode 3', async () => {
      const diff = {
        summary: { totalChanges: 0, tablesChanged: 0, objectsChanged: 0 },
        tables: {},
        droppedTables: [],
        objects: [],
        errors: [{ scope: 'view', name: 'v_active', message: 'permission denied' }],
      };
      (CoreBridge.init as jest.Mock).mockResolvedValue(buildContainer(diff));

      await program.parseAsync(['node', 'andb', 'compare', 'src', 'dest', '--format', 'json']);

      expect(process.exitCode).toBe(3);
      const written = stdoutSpy.mock.calls.map(c => c[0]).join('');
      const parsed = JSON.parse(written);
      expect(parsed.incomplete).toBe(true);
      expect(parsed.errors).toEqual(diff.errors);
      expect(parsed.exitCode).toBe(3);
    });
  });
});
