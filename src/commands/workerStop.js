const workerService = require('../services/workerService');
const logger = require('../utils/logger');

// THE cross-process signaling mechanism, and the answer to
// DECISIONS.md Q4. This process has no parent/child relationship with
// the worker processes at all -- it's a totally separate CLI
// invocation. It works because:
//   1. Every worker writes its own OS pid into the `workers` collection
//      on startup (workerService.registerWorker).
//   2. Node's process.kill(pid, signal) can signal ANY process on the
//      machine that the current user owns -- not just child processes.
// This is why "worker stop" from a different terminal works: it reads
// pids from the database (the only channel workers communicate through)
// and sends a real OS signal directly to each one.
async function workerStop() {
  const workers = await workerService.listRunningStatusWorkers();

  if (workers.length === 0) {
    logger.info('No workers currently registered as running.');
    return;
  }

  let signaled = 0;
  for (const worker of workers) {
    try {
      process.kill(worker.pid, 'SIGTERM');
      signaled++;
      logger.info(`Sent SIGTERM to ${worker.workerId} (pid ${worker.pid})`);
    } catch (err) {
      // ESRCH means that pid no longer exists -- the registry entry
      // is stale (e.g. the worker was SIGKILL'd earlier). Not fatal;
      // just means there's nothing left to signal for that entry.
      logger.warn(`Could not signal ${worker.workerId} (pid ${worker.pid}): ${err.message}`);
    }
  }

  logger.info(`Signaled ${signaled} worker(s) to shut down gracefully.`);
}

module.exports = { workerStop };
