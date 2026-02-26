import { Test, TestingModule } from '@nestjs/testing';
import { PlaygroundCommand } from '../playground.command';
import { ParserService, ComparatorService, MigratorService } from '@the-andb/core';
import * as fs from 'fs';

jest.mock('fs');

describe('PlaygroundCommand', () => {
  let command: PlaygroundCommand;
  let parser: jest.Mocked<ParserService>;
  let comparator: jest.Mocked<ComparatorService>;
  let migrator: jest.Mocked<MigratorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaygroundCommand,
        {
          provide: ParserService,
          useValue: {
            parseTable: jest.fn(),
          },
        },
        {
          provide: ComparatorService,
          useValue: {
            compareTables: jest.fn(),
          },
        },
        {
          provide: MigratorService,
          useValue: {
            generateAlterSQL: jest.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<PlaygroundCommand>(PlaygroundCommand);
    parser = module.get(ParserService);
    comparator = module.get(ComparatorService);
    migrator = module.get(MigratorService);

    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  it('should fail if source or target are missing', async () => {
    const loggerSpy = jest.spyOn((command as any).logger, 'error');
    await command.run([], {} as any);
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should perform playground diff successfully', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('CREATE TABLE x');

    parser.parseTable.mockReturnValue({} as any);
    comparator.compareTables.mockReturnValue({
      hasChanges: true,
      operations: [{ type: 'ADD' }]
    } as any);
    migrator.generateAlterSQL.mockReturnValue(['ALTER TABLE x ADD y']);

    await command.run([], { source: 's.sql', target: 't.sql' });

    expect(comparator.compareTables).toHaveBeenCalled();
    expect(migrator.generateAlterSQL).toHaveBeenCalled();
  });
});
