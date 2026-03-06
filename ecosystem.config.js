module.exports = {
  apps: [
    {
      name: 'chattybot-backend',
      script: 'src/app.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'summary-worker',
      script: 'workers/summarizeWorker.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '*/5 * * * *',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'lead-extractor',
      script: 'workers/leadExtractor.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '*/10 * * * *',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'missed-lead-worker',
      script: 'workers/missedLeadWorker.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '*/5 * * * *',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'weekly-report-worker',
      script: 'workers/weeklyReportWorker.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 0 * * 0',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
