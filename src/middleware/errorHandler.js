const logger = require('../utils/logger');

// Wraps every command action so a thrown error becomes a clean log
// message and a non-zero exit code, instead of an unhandled promise
// rejection and a raw stack trace dumped on the user.
function withErrorHandling(actionFn) {
  return async (...args) => {
    try {
      await actionFn(...args);
    } catch (err) {
      logger.error(`Command failed: ${err.message}`);
      process.exitCode = 1;
    }
  };
}

module.exports = { withErrorHandling };
