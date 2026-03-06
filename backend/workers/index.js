/**
 * Worker Scheduler
 * 
 * Runs all background workers on a schedule using node-cron.
 * Alternative to PM2 cron_restart for environments that don't support PM2.
 * 
 * Run with: node workers/index.js
 * 
 * Workers are spawned as separate processes for isolation.
 * They only require: DATABASE_URL, OPENAI_API_KEY, SMTP_* settings
 * No Express or app.js dependency.
 */

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const WORKERS_DIR = __dirname;
const runningWorkers = new Map();

console.log('[Scheduler] Worker Scheduler Starting...');
console.log('[Scheduler] Environment check:');
console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✓ set' : '✗ missing'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ set' : '✗ missing'}`);
console.log(`  SMTP_HOST: ${process.env.SMTP_HOST ? '✓ set' : '○ optional'}`);

function runWorker(name, scriptPath) {
  if (runningWorkers.get(name)) {
    console.log(`[Scheduler] ${name} already running, skipping`);
    return;
  }

  console.log(`[Scheduler] Starting ${name}...`);
  
  const worker = spawn('node', [scriptPath], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });

  runningWorkers.set(name, worker.pid);

  worker.on('close', (code) => {
    console.log(`[Scheduler] ${name} exited with code ${code}`);
    runningWorkers.set(name, null);
  });

  worker.on('error', (err) => {
    console.error(`[Scheduler] ${name} error:`, err);
    runningWorkers.set(name, null);
  });
}

// Worker Definitions
const workers = {
  summarizeWorker: {
    path: path.join(WORKERS_DIR, 'summarizeWorker.js'),
    schedule: '*/5 * * * *',
    description: 'every 5 minutes',
  },
  leadExtractor: {
    path: path.join(WORKERS_DIR, 'leadExtractor.js'),
    schedule: '*/10 * * * *',
    description: 'every 10 minutes',
  },
  missedLeadWorker: {
    path: path.join(WORKERS_DIR, 'missedLeadWorker.js'),
    schedule: '*/5 * * * *',
    description: 'every 5 minutes',
  },
  weeklyReportWorker: {
    path: path.join(WORKERS_DIR, 'weeklyReportWorker.js'),
    schedule: '0 0 * * 0',
    description: 'Sundays at midnight',
  },
};

// Schedule all workers
for (const [name, config] of Object.entries(workers)) {
  cron.schedule(config.schedule, () => {
    console.log(`[Scheduler] Triggering ${name} at ${new Date().toISOString()}`);
    runWorker(name, config.path);
  });
}

console.log('[WorkerScheduler] Workers scheduled:');
for (const [name, config] of Object.entries(workers)) {
  console.log(`  - ${name}: ${config.description}`);
}
console.log('[WorkerScheduler] initialized');
console.log('[WorkerScheduler] Scheduler running. Workers are independent of Express.');

process.on('SIGINT', () => {
  console.log('[Scheduler] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Scheduler] Received SIGTERM, shutting down...');
  process.exit(0);
});
