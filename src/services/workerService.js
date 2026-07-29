const Worker = require('../models/Worker');

function generateWorkerId() {
  return `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

async function registerWorker(workerId) {
  await Worker.findOneAndUpdate(
    { workerId },
    { $set: { pid: process.pid, status: 'running', lastHeartbeat: new Date(), startedAt: new Date() } },
    { upsert: true }
  );
}

async function heartbeat(workerId) {
  await Worker.updateOne({ workerId }, { $set: { lastHeartbeat: new Date() } });
}

async function markStopping(workerId) {
  await Worker.updateOne({ workerId }, { $set: { status: 'stopping' } });
}

async function markStopped(workerId) {
  await Worker.updateOne({ workerId }, { $set: { status: 'dead' } });
}

// Used by `status` / `health` -- only counts workers whose heartbeat
// is recent, so a worker that crashed without updating its status
// still correctly disappears from "active" after HEARTBEAT_INTERVAL_MS-ish.
async function listActiveWorkers(staleAfterMs = 10000) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  return Worker.find({ status: 'running', lastHeartbeat: { $gte: cutoff } }).lean();
}

// Used by `worker stop` -- deliberately does NOT filter by heartbeat
// recency. worker stop's job is to reach every worker the registry
// still thinks is running and attempt a signal; a stale/dead pid
// simply fails process.kill() harmlessly (caught in workerStop.js).
async function listRunningStatusWorkers() {
  return Worker.find({ status: 'running' }).lean();
}

async function listAllWorkers() {
  return Worker.find({}).sort({ startedAt: -1 }).lean();
}

module.exports = {
  generateWorkerId,
  registerWorker,
  heartbeat,
  markStopping,
  markStopped,
  listActiveWorkers,
  listRunningStatusWorkers,
  listAllWorkers,
};
