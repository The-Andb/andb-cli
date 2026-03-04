import { Command } from 'commander';
import { register } from '../generate.command';

describe('GenerateCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
  });

  it('should register the generate command with alias', () => {
    const cmd = program.commands.find(c => c.name() === 'generate');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Generate scripts and utilities for package.json');
    expect(cmd!.aliases()).toContain('gen');
  });

  it('should have environment options', () => {
    const cmd = program.commands.find(c => c.name() === 'generate')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--environments');
    expect(optNames).toContain('--compare-envs');
    expect(optNames).toContain('--migrate-envs');
  });
});
