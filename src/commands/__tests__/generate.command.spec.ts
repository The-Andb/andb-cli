import { Test, TestingModule } from '@nestjs/testing';
import { GenerateCommand } from '../generate.command';
import * as fs from 'fs';

jest.mock('fs');

describe('GenerateCommand', () => {
  let command: GenerateCommand;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenerateCommand],
    }).compile();

    command = module.get<GenerateCommand>(GenerateCommand);
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should generate scripts and update package.json', async () => {
    const mockPackageJson = {
      name: 'test-app',
      scripts: {},
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPackageJson));
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    await command.run([], { environments: 'DEV,PROD' });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('export:dev')
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('compare:prod')
    );
  });

  it('should create package.json if it does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    await command.run([], { environments: 'DEV' });

    expect(fs.writeFileSync).toHaveBeenCalled();
    const callArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const content = JSON.parse(callArgs[1]);
    expect(content.name).toBeDefined();
    expect(content.scripts['export:dev']).toBeDefined();
  });
});
