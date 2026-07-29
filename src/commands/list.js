const jobService = require('../services/jobService');

async function list(options) {
  const jobs = await jobService.listJobs(options.state);

  if (options.json) {
    // Interface contract requirement: ONLY a JSON array on stdout,
    // nothing else. This is why we use process.stdout.write directly
    // instead of the logger (which would prepend [INFO] etc).
    process.stdout.write(JSON.stringify(jobs) + '\n');
    return;
  }

  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  for (const job of jobs) {
    console.log(
      `${job.jobId}  ${job.state.padEnd(12)} attempts=${job.attempts}/${job.maxRetries}  ${job.command}`
    );
  }
}

module.exports = { list };
