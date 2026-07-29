const mongoose = require('mongoose');
const { DEFAULTS } = require('../constants/jobStates');

// A single-document "singleton" collection -- simplest possible way
// to store global settings without a dedicated key-value store.
const configSchema = new mongoose.Schema({
  singleton: { type: String, default: 'singleton', unique: true },
  maxRetries: { type: Number, default: DEFAULTS.MAX_RETRIES },
  backoffBase: { type: Number, default: DEFAULTS.BACKOFF_BASE },
});

module.exports = mongoose.model('Config', configSchema);
