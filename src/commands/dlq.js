const jobService = require('../services/jobService');
const logger = require('../utils/logger');

async function dlqList() {
  const deadJobs = await jobService.listDeadJobs();
  if (deadJobs.length === 0) {
    console.log('DLQ is empty.');
    return;
  }
  for (const job of deadJobs) {
    console.log(`${job.jobId}  attempts=${job.attempts}/${job.maxRetries}  ${job.command}`);
  }
}

async function dlqRetry(jobId) {
  const job = await jobService.retryDeadJob(jobId);
  if (!job) {
    logger.warn(`Job ${jobId} not found in DLQ.`);
    return;
  }
  logger.success(`Job ${jobId} re-enqueued from DLQ (attempts reset to 0).`);
}

module.exports = { dlqList, dlqRetry };
