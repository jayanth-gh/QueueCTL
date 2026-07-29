const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, unique: true },
    // The OS pid is the entire mechanism behind `worker stop` working
    // from a different terminal -- see workerService/workerStop.
    pid: { type: Number, required: true },
    status: {
      type: String,
      enum: ['running', 'stopping', 'dead'],
      default: 'running',
    },
    lastHeartbeat: { type: Date, default: Date.now },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Worker', workerSchema);
