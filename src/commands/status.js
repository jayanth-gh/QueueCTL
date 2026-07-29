const chalk = require('chalk');
const jobService = require('../services/jobService');
const workerService = require('../services/workerService');

async function status() {
  const summary = await jobService.getStatusSummary();
  const activeWorkers = await workerService.listActiveWorkers();

  console.log(chalk.bold('\nJob Summary'));
  for (const [state, count] of Object.entries(summary)) {
    console.log(`  ${state.padEnd(12)} ${count}`);
  }

  console.log(chalk.bold(`\nActive Workers: ${activeWorkers.length}`));
  for (const w of activeWorkers) {
    console.log(`  ${w.workerId} (pid ${w.pid})`);
  }
  console.log('');
}

module.exports = { status };
