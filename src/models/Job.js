const mongoose = require('mongoose');
const { JOB_STATES } = require('../constants/jobStates');

const jobSchema = new mongoose.Schema(
  {
    // The user-supplied id from the enqueue payload, not Mongo's _id.
    // Kept unique so re-enqueuing the same id is a clear application error,
    // not a silent duplicate.
    jobId: { type: String, required: true, unique: true },
    command: { type: String, required: true },
    state: {
      type: String,
      enum: Object.values(JOB_STATES),
      default: JOB_STATES.PENDING,
    },
    // Counts completed (failed) attempts -- used directly in the
    // backoff formula: delay = backoffBase ^ attempts.
    attempts: { type: Number, default: 0 },
    maxRetries: { type: Number, required: true },
    // Set only while state === 'processing'. Both are cleared the
    // moment a job leaves that state (completed, failed, or dead).
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    // A job is only eligible for claiming once nextRunAt <= now.
    // This is how backoff delay is enforced without a separate scheduler.
    nextRunAt: { type: Date, default: Date.now },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

// This compound index is what makes claimNextJob's query
// (state=pending AND nextRunAt<=now, sorted by nextRunAt) fast even
// with a large backlog of jobs in other states.
jobSchema.index({ state: 1, nextRunAt: 1 });

module.exports = mongoose.model('Job', jobSchema);
