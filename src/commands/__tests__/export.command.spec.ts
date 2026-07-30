import { Command } from 'commander';

jest.mock('@the-andb/core', () => ({
  CoreBridge: { init: jest.fn() },
  BaseStorageStrategy: class {},
}));

import { register } from '../export.command';
import { CoreBridge } from '@the-andb/core';

describe('ExportCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
  });

  it('should register the export command', () => {
    const cmd = program.commands.find(c => c.name() === 'export');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Export database schema to files');
  });

  it('should have --env and --name options', () => {
    const cmd = program.commands.find(c => c.name() === 'export')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--env');
    expect(optNames).toContain('--name');
  });

  describe('partial-failure surfacing', () => {
    let errorSpy: jest.SpyInstance;
    let tableSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      tableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
      process.exitCode = undefined;
    });

    afterEach(() => {
      errorSpy.mockRestore();
      tableSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('exits with code 3 and prints error details when errorCount > 0', async () => {
      (CoreBridge.init as jest.Mock).mockResolvedValue({
        exporter: {
          exportSchema: jest.fn().mockResolvedValue({
            TABLES: 5,
            savedCount: 4,
            errorCount: 1,
            errors: [{ type: 'TABLES', name: 'orders', message: 'connection reset' }],
          }),
        },
      });

      await program.parseAsync(['node', 'andb', 'export', '--env', 'dev']);

      expect(process.exitCode).toBe(3);
      const printed = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(printed).toContain('orders');
      expect(printed).toContain('connection reset');
    });

    it('exits with code 0 when there are no per-object errors', async () => {
      (CoreBridge.init as jest.Mock).mockResolvedValue({
        exporter: {
          exportSchema: jest.fn().mockResolvedValue({
            TABLES: 5,
            savedCount: 5,
            errorCount: 0,
            errors: [],
          }),
        },
      });

      await program.parseAsync(['node', 'andb', 'export', '--env', 'dev']);

      expect(process.exitCode).toBe(0);
    });
  });
});
