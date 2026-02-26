import { Test, TestingModule } from '@nestjs/testing';
import { MigrateCommand } from '../migrate.command';
import {
  ComparatorService,
  DriverFactoryService,
  ProjectConfigService,
  MigratorService,
  OrchestrationService,
  ANDB_ORCHESTRATOR,
  ConnectionType
} from '@the-andb/core';

describe('MigrateCommand', () => {
  let command: MigrateCommand;
  let comparator: jest.Mocked<ComparatorService>;
  let driverFactory: jest.Mocked<DriverFactoryService>;
  let configService: jest.Mocked<ProjectConfigService>;
  let orchestrator: jest.Mocked<OrchestrationService>;
  let migrator: jest.Mocked<MigratorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrateCommand,
        {
          provide: ComparatorService,
          useValue: {
            compareSchema: jest.fn(),
          },
        },
        {
          provide: MigratorService,
          useValue: {
            generateAlterSQL: jest.fn(),
            generateObjectSQL: jest.fn(),
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
          provide: ANDB_ORCHESTRATOR,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<MigrateCommand>(MigrateCommand);
    comparator = module.get(ComparatorService);
    migrator = module.get(MigratorService);
    driverFactory = module.get(DriverFactoryService);
    configService = module.get(ProjectConfigService);
    orchestrator = module.get(ANDB_ORCHESTRATOR);

    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  it('should run migration with force flag', async () => {
    const connConfig = {
      type: ConnectionType.MYSQL,
      config: { database: 'test' },
    };
    configService.getConnection.mockReturnValue(connConfig);

    const mockDriver = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getIntrospectionService: jest.fn().mockReturnValue({
        getTableDDL: jest.fn().mockResolvedValue('CREATE TABLE x'),
      }),
      getMigrator: jest.fn().mockReturnValue({}),
    };

    driverFactory.create.mockResolvedValue(mockDriver as any);
    comparator.compareSchema.mockResolvedValue({
      summary: { totalChanges: 1 },
      tables: { users: { tableName: 'users', hasChanges: true, operations: [{ type: 'ADD', target: 'COLUMN', name: 'age', definition: 'int' }] } },
      droppedTables: [],
      objects: [],
    } as any);

    migrator.generateAlterSQL = jest.fn().mockReturnValue(['ALTER TABLE users ADD COLUMN age int;']);
    migrator.generateObjectSQL = jest.fn().mockReturnValue([]);

    orchestrator.execute.mockResolvedValue({
      success: true,
      successful: [{ name: 'users' }],
      failed: [],
    });

    await command.run(['dev', 'prod'], { force: true });

    expect(orchestrator.execute).toHaveBeenCalledWith('migrate', expect.objectContaining({
      srcEnv: 'dev',
      destEnv: 'prod',
    }));
  });

  it('should handle migration failure', async () => {
    configService.getConnection.mockReturnValue({
      type: ConnectionType.MYSQL,
      config: { database: 'test' },
    });

    driverFactory.create.mockResolvedValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getIntrospectionService: jest.fn().mockReturnValue({
        getTableDDL: jest.fn().mockResolvedValue(''),
      }),
      getMigrator: jest.fn().mockReturnValue({}),
    } as any);

    comparator.compareSchema.mockResolvedValue({
      summary: { totalChanges: 1 },
      tables: { users: { operations: [{ type: 'ADD' }] } },
      droppedTables: [],
      objects: [],
    } as any);

    orchestrator.execute.mockResolvedValue({
      success: false,
    } as any);

    const loggerSpy = jest.spyOn((command as any).logger, 'error');
    await command.run(['dev', 'prod'], { force: true });

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });
});
