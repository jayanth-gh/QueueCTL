const JobLog = require('../models/JobLog');

async function recordLog({ jobId, workerId, status, attempt, durationMs, error }) {
  await JobLog.create({ jobId, workerId, status, attempt, durationMs, error: error || null });
}

async function getLogsForJob(jobId) {
  return JobLog.find({ jobId }).sort({ timestamp: 1 }).lean();
}

module.exports = { recordLog, getLogsForJob };
