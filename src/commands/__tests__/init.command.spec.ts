import { Test, TestingModule } from '@nestjs/testing';
import { InitCommand } from '../init.command';
import * as fs from 'fs';

jest.mock('fs');

describe('InitCommand', () => {
  let command: InitCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InitCommand],
    }).compile();

    command = module.get<InitCommand>(InitCommand);
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should create andb.yaml if it does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    await command.run();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('andb.yaml'),
      expect.stringContaining('The Andb Configuration')
    );
  });

  it('should skip if andb.yaml already exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const loggerSpy = jest.spyOn((command as any).logger, 'warn');

    await command.run();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });
});
