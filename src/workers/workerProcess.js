require('dotenv').config();
const { connectDB } = require('../config/db');
const jobService = require('../services/jobService');
const workerService = require('../services/workerService');
const logService = require('../services/logService');
const { executeCommand } = require('./executor');
const { startStaleJobRecovery } = require('../scheduler/staleJobRecovery');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 3000);
const STALE_JOB_THRESHOLD_MS = Number(process.env.STALE_JOB_THRESHOLD_MS || 15000);

const workerId = workerService.generateWorkerId();
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mainLoop() {
  while (!shuttingDown) {
    const job = await jobService.claimNextJob(workerId);

    if (!job) {
      // Nothing to do -- check the shutdown flag again after a short
      // sleep rather than busy-looping the database with queries.
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    logger.info(`[${workerId}] claimed job ${job.jobId} (attempt ${job.attempts + 1})`);
    const result = await executeCommand(job.command);

    if (result.success) {
      await jobService.markCompleted(job.jobId);
      await logService.recordLog({
        jobId: job.jobId,
        workerId,
        status: 'completed',
        attempt: job.attempts + 1,
        durationMs: result.durationMs,
      });
      logger.success(`[${workerId}] job ${job.jobId} completed in ${result.durationMs}ms`);
    } else {
      const newState = await jobService.markFailed(job);
      await logService.recordLog({
        jobId: job.jobId,
        workerId,
        status: newState,
        attempt: job.attempts + 1,
        durationMs: result.durationMs,
        error: result.error,
      });
      logger.warn(`[${workerId}] job ${job.jobId} -> ${newState} (${result.error})`);
    }

    // IMPORTANT: the while condition is only re-checked here, after the
    // job fully finishes. This is what "finish the in-flight job, then
    // exit" actually means in code -- shuttingDown can flip to true
    // mid-execution, but we never abandon a job we've already claimed.
  }

  await workerService.markStopped(workerId);
  logger.info(`[${workerId}] shut down gracefully.`);
  process.exit(0);
}

async function handleShutdown(signal) {
  if (shuttingDown) return; // ignore a second Ctrl+C, already stopping
  logger.warn(`[${workerId}] received ${signal}. Will finish any in-flight job, then exit.`);
  await workerService.markStopping(workerId);
  shuttingDown = true;
}

async function start() {
  await connectDB();
  await workerService.registerWorker(workerId);
  logger.info(`[${workerId}] registered and running (pid ${process.pid})`);

  const heartbeatTimer = setInterval(() => {
    workerService.heartbeat(workerId).catch((err) => {
      logger.error(`[${workerId}] heartbeat write failed: ${err.message}`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Every worker runs its own stale-job sweep independently -- see
  // scheduler/staleJobRecovery.js for why this isn't a separate daemon.
  const recoveryTimer = startStaleJobRecovery(STALE_JOB_THRESHOLD_MS, POLL_INTERVAL_MS * 3);

  // These handlers cover BOTH same-terminal Ctrl+C and a signal sent
  // from `worker stop` in another terminal -- process.on('SIGTERM')
  // fires the same way regardless of who sent the signal.
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  // SIGKILL cannot be caught by design (this is an OS-level guarantee,
  // not a gap in this code) -- that's why crash recovery exists at all.

  await mainLoop();

  clearInterval(heartbeatTimer);
  clearInterval(recoveryTimer);
}

start();
