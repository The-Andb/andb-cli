import { Test, TestingModule } from '@nestjs/testing';
import { HelperCommand } from '../helper.command';
import * as fs from 'fs';

jest.mock('fs');

describe('HelperCommand', () => {
  let command: HelperCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HelperCommand],
    }).compile();

    command = module.get<HelperCommand>(HelperCommand);
  });

  it('should show usage by default', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await command.run([], {});
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Commands'));
  });

  it('should show configuration', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await command.run([], { config: true });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'));
  });

  it('should list scripts from package.json', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      scripts: { 'export:dev': 'andb export dev' }
    }));
    const consoleSpy = jest.spyOn(console, 'log');

    await command.run([], { list: true });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('export:dev'));
  });
});
