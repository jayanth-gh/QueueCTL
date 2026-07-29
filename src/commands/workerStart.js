const path = require('path');
const { fork } = require('child_process');
const logger = require('../utils/logger');

// This command itself never touches the database -- it only spawns
// real OS processes (fork, not just async functions) running
// workerProcess.js, each of which connects to Mongo independently.
async function workerStart(options) {
  const count = Number(options.count || 1);
  const children = [];

  logger.info(`Starting ${count} worker process(es) in the foreground...`);

  for (let i = 0; i < count; i++) {
    const child = fork(path.join(__dirname, '..', 'workers', 'workerProcess.js'), [], {
      stdio: 'inherit', // so each worker's colored logs show in this terminal
    });
    children.push(child);
  }

  // Ctrl+C in THIS terminal forwards SIGTERM to our own children.
  // (worker stop, from a different terminal, reaches them independently
  // via their pid stored in the workers collection -- see workerStop.js.)
  const forwardSignal = (signal) => {
    for (const child of children) {
      if (!child.killed) child.kill(signal);
    }
  };
  process.on('SIGINT', () => forwardSignal('SIGTERM'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  // Blocks until every child worker has exited -- this is what makes
  // `worker start` a foreground, blocking command as the contract requires.
  await Promise.all(
    children.map((child) => new Promise((resolve) => child.on('exit', resolve)))
  );

  logger.info('All workers have exited. worker start finished.');
}

module.exports = { workerStart };
