const mongoose = require('mongoose');

// One document per execution attempt -- this is what backs `queuectl logs <jobId>`
// and the metrics command. Kept separate from Job itself so the job document
// stays small and the log history isn't lost when a job transitions state.
const jobLogSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  workerId: { type: String, required: true },
  status: { type: String, required: true }, // completed | pending (retry) | dead
  attempt: { type: Number, required: true },
  durationMs: { type: Number, required: true },
  error: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

jobLogSchema.index({ jobId: 1, timestamp: -1 });

module.exports = mongoose.model('JobLog', jobLogSchema);
