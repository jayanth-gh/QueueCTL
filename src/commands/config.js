const configService = require('../services/configService');
const logger = require('../utils/logger');

async function configSet(key, value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new Error(`Config value must be numeric, got "${value}"`);
  }

  if (key === 'max-retries') {
    await configService.setMaxRetries(numericValue);
    logger.success(`max-retries set to ${numericValue} (applies to newly enqueued jobs)`);
  } else if (key === 'backoff-base') {
    await configService.setBackoffBase(numericValue);
    logger.success(`backoff-base set to ${numericValue} (applies to the next retry of any pending job)`);
  } else {
    throw new Error(`Unknown config key "${key}". Use max-retries or backoff-base.`);
  }
}

async function configShow() {
  const config = await configService.getConfig();
  console.log(`max-retries: ${config.maxRetries}`);
  console.log(`backoff-base: ${config.backoffBase}`);
}

module.exports = { configSet, configShow };
