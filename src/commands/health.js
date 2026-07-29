const chalk = require('chalk');
const workerService = require('../services/workerService');
const jobService = require('../services/jobService');

async function health() {
  const activeWorkers = await workerService.listActiveWorkers();
  const summary = await jobService.getStatusSummary();

  console.log(chalk.bold('QueueCTL Health'));
  console.log(`  Active workers:            ${activeWorkers.length}`);
  console.log(`  Jobs currently processing: ${summary.processing || 0}`);
  console.log(`  Jobs pending:              ${summary.pending || 0}`);
  console.log(`  Jobs in DLQ:               ${summary.dead || 0}`);

  if (activeWorkers.length === 0 && (summary.processing || 0) > 0) {
    console.log(chalk.yellow('  Warning: jobs show as processing but no active workers were found.'));
    console.log(chalk.yellow('  These should self-recover within the stale-job threshold.'));
  }
}

module.exports = { health };
