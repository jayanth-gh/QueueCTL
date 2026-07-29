const fs = require("fs");
const jobService = require('../services/jobService');
const logger = require('../utils/logger');

async function enqueue(jsonString) {
  let payload;
  console.log("Received:", jsonString);
   try {
        if (fs.existsSync(jsonString)) {
            const content = fs.readFileSync(jsonString, "utf8");
            payload = JSON.parse(content);
        } else {
            payload = JSON.parse(jsonString);
        }
    } catch (err) {
        throw new Error(`Invalid JSON provided to enqueue: ${err.message}`);
    }

  if (!payload.id || !payload.command) {
    throw new Error('Job must include at least "id" and "command".');
  }

  const job = await jobService.enqueueJob({
    id: payload.id,
    command: payload.command,
    maxRetries: payload.max_retries,
  });

  logger.success(`Enqueued job ${job.jobId}`);
}

module.exports = { enqueue };
