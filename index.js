#!/usr/bin/env node
require('dotenv').config();
const { Command } = require('commander');

const { connectDB } = require('./src/config/db');
const { withErrorHandling } = require('./src/middleware/errorHandler');

const { enqueue } = require('./src/commands/enqueue');
const { workerStart } = require('./src/commands/workerStart');
const { workerStop } = require('./src/commands/workerStop');
const { status } = require('./src/commands/status');
const { list } = require('./src/commands/list');
const { dlqList, dlqRetry } = require('./src/commands/dlq');
const { configSet, configShow } = require('./src/commands/config');
const { health } = require('./src/commands/health');
const { metrics } = require('./src/commands/metrics');
const { logs } = require('./src/commands/logs');

const program = new Command();
program.name('queuectl').description('A CLI-based background job queue system.');

program
  .command('enqueue <json>')
  .description('Add a new job. Example: queuectl enqueue \'{"id":"job1","command":"sleep 2"}\'')
  .action(
    withErrorHandling(async (json) => {
      await connectDB();
      await enqueue(json);
    })
  );

// Note: worker start deliberately does NOT call connectDB() here --
// it never touches the database itself, it only forks worker
// processes which each connect independently. See workerStart.js.
const workerCmd = program.command('worker').description('Manage worker processes');

workerCmd
  .command('start')
  .option('--count <n>', 'number of worker processes to start', '1')
  .description('Start worker processes in the foreground.')
  .action(withErrorHandling(async (options) => {
    await workerStart(options);
  }));

workerCmd
  .command('stop')
  .description('Gracefully stop all running workers (works from a different terminal).')
  .action(withErrorHandling(async () => {
    await connectDB();
    await workerStop();
  }));

const dlqCmd = program.command('dlq').description('Manage the dead letter queue');

dlqCmd
  .command('list')
  .description('List jobs currently in the DLQ.')
  .action(withErrorHandling(async () => {
    await connectDB();
    await dlqList();
  }));

dlqCmd
  .command('retry <jobId>')
  .description('Re-enqueue a dead job.')
  .action(withErrorHandling(async (jobId) => {
    await connectDB();
    await dlqRetry(jobId);
  }));

const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a config value: max-retries or backoff-base.')
  .action(withErrorHandling(async (key, value) => {
    await connectDB();
    await configSet(key, value);
  }));

configCmd
  .command('show')
  .description('Show current configuration.')
  .action(withErrorHandling(async () => {
    await connectDB();
    await configShow();
  }));

program
  .command('status')
  .description('Show a summary of all job states and active workers.')
  .action(withErrorHandling(async () => {
    await connectDB();
    await status();
  }));

program
  .command('list')
  .option('--state <state>', 'filter by job state (pending|processing|completed|failed|dead)')
  .option('--json', 'output as a raw JSON array (nothing else on stdout)')
  .description('List jobs, optionally filtered by state.')
  .action(withErrorHandling(async (options) => {
    await connectDB();
    await list(options);
  }));

program
  .command('health')
  .description('Show queue and worker health.')
  .action(withErrorHandling(async () => {
    await connectDB();
    await health();
  }));

program
  .command('metrics')
  .description('Show aggregate queue metrics.')
  .action(withErrorHandling(async () => {
    await connectDB();
    await metrics();
  }));

program
  .command('logs <jobId>')
  .description('Show execution log history for a specific job.')
  .action(withErrorHandling(async (jobId) => {
    await connectDB();
    await logs(jobId);
  }));

program.parseAsync(process.argv);
