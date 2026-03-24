import { BaseStorageStrategy } from '@the-andb/core';

export class CliStorageStrategy extends BaseStorageStrategy {
  async initialize(dbPath: string): Promise<void> {
    // CLI does not have extra entities, just core ones
    await super.initialize(dbPath, []);
  }
}
