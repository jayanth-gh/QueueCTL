const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'queuectl.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeToFile(line) {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// Every level writes to both console (colored, for the human watching)
// and the log file (plain text, for `queuectl logs` / grepping later).
// NOTE: none of these ever touch stdout during `list --json` --
// that command bypasses this logger entirely to keep stdout clean.
function info(message) {
  console.log(chalk.blue('[INFO]'), message);
  writeToFile(`[INFO] ${new Date().toISOString()} ${message}`);
}

function success(message) {
  console.log(chalk.green('[OK]'), message);
  writeToFile(`[OK] ${new Date().toISOString()} ${message}`);
}

function warn(message) {
  console.log(chalk.yellow('[WARN]'), message);
  writeToFile(`[WARN] ${new Date().toISOString()} ${message}`);
}

function error(message) {
  console.log(chalk.red('[ERROR]'), message);
  writeToFile(`[ERROR] ${new Date().toISOString()} ${message}`);
}

module.exports = { info, success, warn, error };
