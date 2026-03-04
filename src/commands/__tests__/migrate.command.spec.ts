import { Command } from 'commander';
import { register } from '../migrate.command';

describe('MigrateCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
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
});
