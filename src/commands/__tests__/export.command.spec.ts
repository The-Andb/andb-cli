import { Command } from 'commander';
import { register } from '../export.command';

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
});
