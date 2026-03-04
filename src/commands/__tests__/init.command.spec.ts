import * as fs from 'fs';
import { Command } from 'commander';
import { register } from '../init.command';

jest.mock('fs');

describe('InitCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    register(program);
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should register the init command', () => {
    const initCmd = program.commands.find(c => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd!.description()).toBe('Initialize a new Andb project with default config');
  });

  it('should create andb.yaml if it does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    await program.parseAsync(['node', 'test', 'init']);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('andb.yaml'),
      expect.stringContaining('The Andb Configuration')
    );
  });

  it('should skip if andb.yaml already exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'init']);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
