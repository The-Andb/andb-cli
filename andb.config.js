/**
 * ANDB Configuration Example
 * Copy this file to your project root as andb.config.js
 */

module.exports = {
  /**
   * Get database connection config for environment
   */
  getDBDestination: (env) => ({
    host: process.env[`${env}_DB_HOST`] || 'localhost',
    database: process.env[`${env}_DB_NAME`],
    user: process.env[`${env}_DB_USER`],
    password: process.env[`${env}_DB_PASS`],
    port: process.env[`${env}_DB_PORT`] || 3306,
    envName: env
  }),

  /**
   * Get database name for environment
   */
  getDBName: (env) => process.env[`${env}_DB_NAME`],

  /**
   * Get source environment (for comparison)
   */
  getSourceEnv: (destEnv) => {
    const mapping = {
      STAGE: 'DEV',
      UAT: 'STAGE',
      PROD: 'UAT'
    };
    return mapping[destEnv] || 'DEV';
  },

  /**
   * Get destination environment
   */
  getDestEnv: (srcEnv) => {
    const mapping = {
      DEV: 'STAGE',
      STAGE: 'UAT',
      UAT: 'PROD'
    };
    return mapping[srcEnv] || 'STAGE';
  },

  /**
   * Replace environment-specific strings
   */
  replaceWithEnv: (str, env) => str,

  /**
   * List of available environments with exactly
   */
  ENVIRONMENTS: ['DEV', 'STAGE', 'UAT', 'PROD']
};
