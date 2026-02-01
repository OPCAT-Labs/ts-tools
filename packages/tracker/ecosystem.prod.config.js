// PM2 Production Config for CAT Tracker
// - envConfig: general config from .env.prod (dotenv format)
// - secrets: sensitive data from JS file (not committed to git)
const dotenv = require('dotenv');
const path = require('path');

const BASE_DIR = '/home/opcat/tracker';
const envConfig = dotenv.config({ path: path.join(BASE_DIR, '.env.prod') }).parsed || {};
const secrets = require(path.join(BASE_DIR, 'secrets.js'));

module.exports = {
  apps: [
    {
      name: 'cat-tracker-worker',
      script: 'dist/main-worker.js',
      cwd: BASE_DIR,
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...envConfig,
        ...secrets,
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      merge_logs: true,
    },
    {
      name: 'cat-tracker-api',
      script: 'dist/main-api.js',
      cwd: BASE_DIR,
      instances: 1,
      exec_mode: 'fork',
      env: {
        ...envConfig,
        ...secrets,
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
