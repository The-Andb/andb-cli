import { Command } from 'commander';
import { register } from '../helper.command';

describe('HelperCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
  });

  it('should register the helper command', () => {
    const cmd = program.commands.find(c => c.name() === 'helper');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Helper utilities and tools');
  });

  it('should have --list and --config options', () => {
    const cmd = program.commands.find(c => c.name() === 'helper')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--list');
    expect(optNames).toContain('--config');
  });
});
