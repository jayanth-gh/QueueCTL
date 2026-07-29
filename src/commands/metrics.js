const JobLog = require('../models/JobLog');
const jobService = require('../services/jobService');

async function metrics() {
  const summary = await jobService.getStatusSummary();
  const totalAttempts = await JobLog.countDocuments();

  const avgDurationResult = await JobLog.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, avgDuration: { $avg: '$durationMs' } } },
  ]);
  const avgDuration = avgDurationResult[0]?.avgDuration || 0;

  console.log('QueueCTL Metrics');
  console.log(`  Total execution attempts logged: ${totalAttempts}`);
  console.log(`  Average completed job duration:  ${avgDuration.toFixed(1)}ms`);
  console.log('  Jobs by state:');
  for (const [state, count] of Object.entries(summary)) {
    console.log(`    ${state.padEnd(12)} ${count}`);
  }
}

module.exports = { metrics };
