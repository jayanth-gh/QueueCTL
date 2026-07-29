// Single source of truth for job states -- every model and service
// references this instead of hardcoding strings, so a typo becomes
// a crash at require-time instead of a silent bad query.
const JOB_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead',
};

// Defaults used when a job is enqueued without explicit overrides,
// and as the initial values for the Config singleton document.
const DEFAULTS = {
  MAX_RETRIES: 3,
  BACKOFF_BASE: 2,
};

module.exports = { JOB_STATES, DEFAULTS };
