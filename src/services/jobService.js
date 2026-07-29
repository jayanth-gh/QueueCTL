const Job = require('../models/Job');
const { JOB_STATES } = require('../constants/jobStates');
const { computeNextRunAt } = require('../utils/backoff');
const { getConfig } = require('./configService');

// maxRetries is snapshotted onto the job at enqueue time. This means
// a later `config set max-retries` does NOT change already-enqueued
// jobs -- only jobs enqueued after the change. Documented in DECISIONS.md.
async function enqueueJob({ id, command, maxRetries }) {
  const config = await getConfig();
  const job = await Job.create({
    jobId: id,
    command,
    maxRetries: maxRetries ?? config.maxRetries,
    state: JOB_STATES.PENDING,
    nextRunAt: new Date(),
  });
  return job;
}

// THE atomic claim. findOneAndUpdate executes as a single atomic
// operation at the MongoDB storage engine level -- no other process
// can read this document mid-update. The filter (state: 'pending')
// is the guard: once one worker's update flips the state to
// 'processing', every other worker's identical query simply stops
// matching that document. This is what makes claiming safe across
// separate OS processes, not just separate threads.
async function claimNextJob(workerId) {
  const job = await Job.findOneAndUpdate(
    {
      state: JOB_STATES.PENDING,
      nextRunAt: { $lte: new Date() },
    },
    {
      $set: {
        state: JOB_STATES.PROCESSING,
        claimedBy: workerId,
        claimedAt: new Date(),
      },
    },
    { sort: { nextRunAt: 1 }, new: true }
  );
  return job;
}

async function markCompleted(jobId) {
  // attempts is NOT incremented here -- it only counts failed
  // attempts, which is what the backoff formula expects.
  await Job.updateOne(
    { jobId },
    { $set: { state: JOB_STATES.COMPLETED, claimedBy: null, claimedAt: null } }
  );
}

async function markFailed(job) {
  const config = await getConfig();
  const attemptsAfterThisFailure = job.attempts + 1;

  if (attemptsAfterThisFailure >= job.maxRetries) {
    await Job.updateOne(
      { jobId: job.jobId },
      {
        $set: { state: JOB_STATES.DEAD, claimedBy: null, claimedAt: null },
        $inc: { attempts: 1 },
      }
    );
    return JOB_STATES.DEAD;
  }

  // backoffBase is read fresh from config on every failure -- so unlike
  // maxRetries, a `config set backoff-base` DOES affect the next retry
  // delay of jobs that are already enqueued and mid-retry-cycle.
  const nextRunAt = computeNextRunAt(config.backoffBase, attemptsAfterThisFailure);
  await Job.updateOne(
    { jobId: job.jobId },
    {
      $set: {
        state: JOB_STATES.PENDING,
        claimedBy: null,
        claimedAt: null,
        nextRunAt,
      },
      $inc: { attempts: 1 },
    }
  );
  return JOB_STATES.PENDING;
}

// Sweeps jobs stuck in 'processing' whose claimedAt is older than the
// threshold -- this is the crash-recovery mechanism for SIGKILL'd workers.
// attempts is intentionally NOT incremented: the job never actually
// finished running, so we don't know if it would have failed.
async function recoverStaleJobs(thresholdMs) {
  const staleCutoff = new Date(Date.now() - thresholdMs);
  const result = await Job.updateMany(
    { state: JOB_STATES.PROCESSING, claimedAt: { $lt: staleCutoff } },
    {
      $set: {
        state: JOB_STATES.PENDING,
        claimedBy: null,
        claimedAt: null,
        nextRunAt: new Date(),
      },
    }
  );
  return result.modifiedCount;
}

async function listJobs(state) {
  const filter = state ? { state } : {};
  return Job.find(filter).sort({ createdAt: 1 }).lean();
}

async function getStatusSummary() {
  const counts = await Job.aggregate([{ $group: { _id: '$state', count: { $sum: 1 } } }]);
  const summary = {};
  for (const s of Object.values(JOB_STATES)) summary[s] = 0;
  for (const c of counts) summary[c._id] = c.count;
  return summary;
}

// Resets attempts to 0 -- a DLQ retry is treated as a fresh attempt
// cycle, not a continuation of the exhausted one. Justified in DECISIONS.md.
async function retryDeadJob(jobId) {
  const job = await Job.findOne({ jobId, state: JOB_STATES.DEAD });
  if (!job) return null;
  job.state = JOB_STATES.PENDING;
  job.attempts = 0;
  job.nextRunAt = new Date();
  job.claimedBy = null;
  job.claimedAt = null;
  await job.save();
  return job;
}

async function listDeadJobs() {
  return Job.find({ state: JOB_STATES.DEAD }).sort({ updatedAt: -1 }).lean();
}

module.exports = {
  enqueueJob,
  claimNextJob,
  markCompleted,
  markFailed,
  recoverStaleJobs,
  listJobs,
  getStatusSummary,
  retryDeadJob,
  listDeadJobs,
};
