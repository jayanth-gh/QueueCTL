const logService = require('../services/logService');

async function logs(jobId) {
  const entries = await logService.getLogsForJob(jobId);
  if (entries.length === 0) {
    console.log(`No logs found for job ${jobId}`);
    return;
  }
  for (const entry of entries) {
    const errPart = entry.error ? ` error="${entry.error}"` : '';
    console.log(
      `[${entry.timestamp.toISOString()}] ${entry.workerId} attempt=${entry.attempt} status=${entry.status} duration=${entry.durationMs}ms${errPart}`
    );
  }
}

module.exports = { logs };
