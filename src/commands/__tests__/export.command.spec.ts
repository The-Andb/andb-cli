import { Test, TestingModule } from '@nestjs/testing';
import { ExportCommand } from '../export.command';
import { ExporterService } from '@the-andb/core';

describe('ExportCommand', () => {
  let command: ExportCommand;
  let exporter: jest.Mocked<ExporterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportCommand,
        {
          provide: ExporterService,
          useValue: {
            exportSchema: jest.fn(),
          },
        },
      ],
    }).compile();

    command = module.get<ExportCommand>(ExportCommand);
    exporter = module.get(ExporterService);

    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  it('should fail if env is missing', async () => {
    const loggerSpy = jest.spyOn((command as any).logger, 'error');
    await command.run([], {});
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('required'));
  });

  it('should perform export successfully', async () => {
    exporter.exportSchema.mockResolvedValue({ TABLES: 1, VIEWS: 0 });
    const loggerSpy = jest.spyOn((command as any).logger, 'log');

    await command.run(['dev'], {});

    expect(exporter.exportSchema).toHaveBeenCalledWith('dev', undefined);
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should handle export failure', async () => {
    exporter.exportSchema.mockRejectedValue(new Error('Drive failure'));
    const loggerSpy = jest.spyOn((command as any).logger, 'error');

    await command.run(['dev'], {});

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('failed: Drive failure'));
  });
});
