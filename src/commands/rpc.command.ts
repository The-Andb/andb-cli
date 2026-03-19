import { Command } from 'commander';
import { CoreBridge } from '@the-andb/core';
import * as readline from 'readline';

// In RPC mode, logs should go to stderr to keep stdout clean for JSON-RPC
process.env.ANDB_LOG_TO_STDERR = '1';

const { getLogger } = require('andb-logger');
const logger = getLogger({ logName: 'RPCServer' });

// Monkey-patch console to ensure all downstream logs go to stderr
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

const formatArg = (a: any) => {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'object') {
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  return String(a);
};

console.log = (...args) => process.stderr.write(args.map(formatArg).join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.map(formatArg).join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.map(formatArg).join(' ') + '\n');
console.info = (...args) => process.stderr.write(args.map(formatArg).join(' ') + '\n');

export function register(program: Command) {
  program
    .command('rpc')
    .description('Start JSON-RPC server for persistent core engine interaction')
    .option('--user-data-path <path>', 'Path for user data and storage')
    .option('--sqlite-path <path>', 'Explicit path to sqlite storage')
    .action(async (options: any) => {
      logger.info('🚀 JSON-RPC Server starting...');

      try {
        await CoreBridge.init(options.userDataPath, options.sqlitePath);
        logger.info('✅ Engine ready for RPC.');

        const rl = readline.createInterface({
          input: process.stdin,
          terminal: false
        });

        rl.on('line', async (line) => {
          if (!line.trim()) return;

          try {
            const request = JSON.parse(line);
            const { id, method, params } = request;

            if (!method) {
              sendError(id, -32600, 'Invalid Request: missing method');
              return;
            }

            // Dispatcher
            let result: any;
            try {
              switch (method) {
                case 'execute':
                  // Wrap progress callback to send notifications
                  if (params && params.payload) {
                    params.payload.onProgress = (data: any) => {
                       sendEvent('progress', { ...data, operation: params.operation });
                    };
                  }
                  result = await CoreBridge.execute(params.operation, params.payload);
                  break;
                case 'getStats':
                  result = await (CoreBridge.getStorage() as any).getStats();
                  break;
                case 'getComparisons':
                  result = await (CoreBridge.getStorage() as any).getComparisons(params.srcEnv, params.destEnv, params.database, params.type);
                  break;
                case 'getEnvironments':
                  result = await CoreBridge.getApp()?.config.getEnvironments();
                  break;
                case 'getProjects':
                  {
                    const rawProjects = await (CoreBridge.getStorage() as any).getProjects();
                    const hydrated = [];
                    for (const p of rawProjects) {
                        const settings = await (CoreBridge.getStorage() as any).getProjectSettings(p.id);
                        hydrated.push({
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            connectionIds: settings.connectionIds ? JSON.parse(settings.connectionIds) : [],
                            pairIds: settings.pairIds ? JSON.parse(settings.pairIds) : [],
                            enabledEnvironmentIds: settings.enabledEnvironmentIds ? JSON.parse(settings.enabledEnvironmentIds) : ['DEV', 'STAGE', 'PROD'],
                            isActive: settings.isActive === '1',
                            createdAt: p.created_at,
                            updatedAt: p.updated_at
                        });
                    }
                    result = hydrated;
                  }
                  break;
                case 'saveProject':
                  {
                    const projectData = params.project;
                    await (CoreBridge.getStorage() as any).saveProject({
                        id: projectData.id,
                        name: projectData.name,
                        description: projectData.description || '',
                        is_favorite: 0,
                        order_index: 0
                    });
                    
                    if (projectData.connectionIds) {
                        await (CoreBridge.getStorage() as any).saveProjectSetting(projectData.id, 'connectionIds', JSON.stringify(projectData.connectionIds));
                    }
                    if (projectData.pairIds) {
                        await (CoreBridge.getStorage() as any).saveProjectSetting(projectData.id, 'pairIds', JSON.stringify(projectData.pairIds));
                    }
                    if (projectData.enabledEnvironmentIds) {
                        await (CoreBridge.getStorage() as any).saveProjectSetting(projectData.id, 'enabledEnvironmentIds', JSON.stringify(projectData.enabledEnvironmentIds));
                    }
                    if (projectData.isActive !== undefined) {
                        await (CoreBridge.getStorage() as any).saveProjectSetting(projectData.id, 'isActive', projectData.isActive ? '1' : '0');
                    }
                    
                    result = { success: true };
                  }
                  break;
                case 'deleteProject':
                  result = await (CoreBridge.getStorage() as any).deleteProject(params.id);
                  break;
                case 'getProjectEnvironments':
                  result = await (CoreBridge.getStorage() as any).getProjectEnvironments(params.projectId);
                  break;
                case 'saveProjectEnvironment':
                  result = await (CoreBridge.getStorage() as any).saveProjectEnvironment(params.env);
                  break;
                case 'deleteProjectEnvironment':
                  result = await (CoreBridge.getStorage() as any).deleteProjectEnvironment(params.id);
                  break;
                case 'getDatabases':
                  result = await (CoreBridge.getStorage() as any).getDatabases(params.env);
                  break;
                case 'getDDL':
                  result = await (CoreBridge.getStorage() as any).getDDL(params.env, params.database, params.type, params.name);
                  break;
                case 'getDDLObjects':
                  result = await (CoreBridge.getStorage() as any).getDDLObjects(params.env, params.database, params.type);
                  break;
                case 'getSnapshots':
                  result = await (CoreBridge.getStorage() as any).getSnapshots(params.env, params.database, params.type, params.name);
                  break;
                case 'getAllSnapshots':
                  result = await (CoreBridge.getStorage() as any).getAllSnapshots(params.limit);
                  break;
                case 'getMigrationHistory':
                  result = await (CoreBridge.getStorage() as any).getMigrationHistory(params.limit);
                  break;
                case 'clearConnectionData':
                  result = await (CoreBridge.getStorage() as any).clearConnectionData(params.env, params.database);
                  break;
                case 'getLatestComparisons':
                  result = await (CoreBridge.getStorage() as any).getLatestComparisons(params.limit);
                  break;
                case 'ping':
                  result = 'pong';
                  break;
                case 'getFeaturesStatus':
                  result = await CoreBridge.execute('getFeaturesStatus', {});
                  break;
                case 'updateFeatureFlag':
                  result = await CoreBridge.execute('updateFeatureFlag', params);
                  break;
                case 'parseTable':
                  result = await CoreBridge.getApp()?.parser.parseTableDetailed(params.ddl);
                  break;
                case 'parseTrigger':
                  result = await CoreBridge.getApp()?.parser.parseTrigger(params.ddl);
                  break;
                case 'normalize':
                  result = await CoreBridge.getApp()?.parser.normalize(params.ddl, params.options);
                  break;
                case 'exit':
                  sendResponse(id, 'Goodbye');
                  process.exit(0);
                default:
                  sendError(id, -32601, `Method not found: ${method}`);
                  return;
              }

              sendResponse(id, result);
            } catch (err: any) {
              logger.error(`Error executing ${method}:`, err);
              sendError(id, -32603, err.message || 'Internal error');
            }
          } catch (e) {
            sendError(null, -32700, 'Parse error');
          }
        });

        // Keep process alive
        logger.info('👂 Listening on stdin...');

      } catch (err: any) {
        logger.error('Failed to initialize RPC server:', err);
        // Do not process.exit(1) because Electron relies on this worker staying alive and communicating, 
        // but if initialization fails fundamentally, we log and halt processing.
        // Actually, if it fails to init, we should exit. We will emit an IPC message before exiting.
        process.exit(1);
      }
    });
}

function sendResponse(id: any, result: any) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id: any, code: number, message: string) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: { code, message }
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendEvent(event: string, data: any) {
  const notification = {
    jsonrpc: '2.0',
    method: `event:${event}`,
    params: data
  };
  process.stdout.write(JSON.stringify(notification) + '\n');
}
