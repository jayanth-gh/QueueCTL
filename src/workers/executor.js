const { exec } = require('child_process');

// Runs the job's command through the shell (not execFile) because the
// assignment's job spec allows arbitrary shell commands (pipes, quotes,
// etc). Exit code 0 = success; any non-zero exit (including "command
// not found", which the shell reports as exit 127) resolves as failure.
function executeCommand(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    exec(command, (err, stdout, stderr) => {
      const durationMs = Date.now() - startedAt;
      if (err) {
        resolve({ success: false, durationMs, error: err.message, stdout, stderr });
      } else {
        resolve({ success: true, durationMs, error: null, stdout, stderr });
      }
    });
  });
}

module.exports = { executeCommand };
