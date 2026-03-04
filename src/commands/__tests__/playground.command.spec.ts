import { Command } from 'commander';
import { register } from '../playground.command';

describe('PlaygroundCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
  });

  it('should register the playground command', () => {
    const cmd = program.commands.find(c => c.name() === 'playground');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe('Test andb-core semantic diffing by comparing two local SQL files');
  });

  it('should have --source, --target, --format options', () => {
    const cmd = program.commands.find(c => c.name() === 'playground')!;
    const optNames = cmd.options.map(o => o.long);
    expect(optNames).toContain('--source');
    expect(optNames).toContain('--target');
    expect(optNames).toContain('--format');
  });
});
