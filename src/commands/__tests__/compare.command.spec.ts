import { Command } from 'commander';
import { register } from '../compare.command';

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
});
