/**
 * Worker Scheduler
 * 
 * Runs all background workers on a schedule using node-cron.
 * Alternative to PM2 cron_restart for environments that don't support PM2.
 * 
 * Run with: node workers/index.js
 */

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const WORKERS_DIR = __dirname;

const runningWorkers = new Map();

function runWorker(name, scriptPath) {
  // Don't run if already running
  if (runningWorkers.has(name) && runningWorkers.get(name) !== null) {
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

// Summarize Worker: Every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log(`[Scheduler] Triggering summarizeWorker at ${new Date().toISOString()}`);
  runWorker('summarizeWorker', path.join(WORKERS_DIR, 'summarizeWorker.js'));
});

// Lead Extractor: Every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log(`[Scheduler] Triggering leadExtractor at ${new Date().toISOString()}`);
  runWorker('leadExtractor', path.join(WORKERS_DIR, 'leadExtractor.js'));
});

// Missed Lead Detector: Every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log(`[Scheduler] Triggering missedLeadWorker at ${new Date().toISOString()}`);
  runWorker('missedLeadWorker', path.join(WORKERS_DIR, 'missedLeadWorker.js'));
});

// Weekly Report: Sunday at midnight
cron.schedule('0 0 * * 0', () => {
  console.log(`[Scheduler] Triggering weeklyReportWorker at ${new Date().toISOString()}`);
  runWorker('weeklyReportWorker', path.join(WORKERS_DIR, 'weeklyReportWorker.js'));
});

console.log('[Scheduler] Worker scheduler started');
console.log('[Scheduler] Schedule:');
console.log('  - summarizeWorker: every 5 minutes');
console.log('  - leadExtractor: every 10 minutes');
console.log('  - missedLeadWorker: every 5 minutes');
console.log('  - weeklyReportWorker: Sundays at midnight');

// Keep process alive
process.on('SIGINT', () => {
  console.log('[Scheduler] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Scheduler] Received SIGTERM, shutting down...');
  process.exit(0);
});
