const jobService = require('../services/jobService');
const logger = require('../utils/logger');

// Runs INSIDE every worker's own process -- deliberately not a separate
// daemon. Each worker independently sweeps for stale jobs, so recovery
// doesn't depend on any single "watcher" process staying alive.
function startStaleJobRecovery(thresholdMs, intervalMs) {
  const timer = setInterval(async () => {
    try {
      const recovered = await jobService.recoverStaleJobs(thresholdMs);
      if (recovered > 0) {
        logger.warn(`Recovered ${recovered} stale job(s) abandoned by a crashed worker.`);
      }
    } catch (err) {
      logger.error(`Stale job recovery sweep failed: ${err.message}`);
    }
  }, intervalMs);
  return timer;
}

module.exports = { startStaleJobRecovery };
