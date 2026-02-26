import { Test, TestingModule } from '@nestjs/testing';
import { CompareCommand } from '../compare.command';
import { ComparatorService, DriverFactoryService, ProjectConfigService, ReporterService, ConnectionType } from '@the-andb/core';

describe('CompareCommand', () => {
  let command: CompareCommand;
  let comparator: jest.Mocked<ComparatorService>;
  let driverFactory: jest.Mocked<DriverFactoryService>;
  let configService: jest.Mocked<ProjectConfigService>;
  let reporter: jest.Mocked<ReporterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompareCommand,
        {
          provide: ComparatorService,
          useValue: {
            compareSchema: jest.fn(),
          },
        },
        {
          provide: DriverFactoryService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: ProjectConfigService,
          useValue: {
            getConnection: jest.fn(),
            setAutoBackup: jest.fn(),
          },
        },
        {
          provide: ReporterService,
          useValue: {
            generateHtmlReport: jest.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<CompareCommand>(CompareCommand);
    comparator = module.get(ComparatorService);
    driverFactory = module.get(DriverFactoryService);
    configService = module.get(ProjectConfigService);
    reporter = module.get(ReporterService);

    // Mock process behaviors
    jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => undefined as never);
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fail if source or dest are missing', async () => {
    const loggerSpy = jest.spyOn((command as any).logger, 'error');
    await command.run([], {});
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('required'));
  });

  it('should perform comparison successfully', async () => {
    const mockDiff = {
      summary: { totalChanges: 1, tablesChanged: 1, objectsChanged: 0 },
      tables: { users: { operations: [{ type: 'ADD', name: 'age' }] } },
      droppedTables: [],
      objects: [],
    };

    configService.getConnection.mockReturnValue({
      type: ConnectionType.MYSQL,
      config: { database: 'test' },
    });

    const mockDriver = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getIntrospectionService: jest.fn().mockReturnValue({}),
    };

    driverFactory.create.mockResolvedValue(mockDriver as any);
    comparator.compareSchema.mockResolvedValue(mockDiff as any);

    await command.run(['dev', 'prod'], { format: 'json' });

    expect(driverFactory.create).toHaveBeenCalledTimes(2);
    expect(comparator.compareSchema).toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('"totalChanges": 1'));
  });

  it('should generate report if requested', async () => {
    configService.getConnection.mockReturnValue({
      type: ConnectionType.MYSQL,
      config: { database: 'test' },
    });

    const mockDriver = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getIntrospectionService: jest.fn().mockReturnValue({}),
    };

    driverFactory.create.mockResolvedValue(mockDriver as any);
    comparator.compareSchema.mockResolvedValue({
      summary: { totalChanges: 0 },
      tables: {},
      droppedTables: [],
      objects: [],
    } as any);

    await command.run(['dev', 'prod'], { report: 'test-report.html' });

    expect(reporter.generateHtmlReport).toHaveBeenCalled();
  });
});
