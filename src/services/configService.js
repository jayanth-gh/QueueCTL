const Config = require('../models/Config');

// Lazily creates the singleton config document on first access,
// so a fresh database doesn't need a manual seed step.
async function getConfig() {
  let config = await Config.findOne({ singleton: 'singleton' });
  if (!config) {
    config = await Config.create({ singleton: 'singleton' });
  }
  return config;
}

async function setMaxRetries(value) {
  const config = await getConfig();
  config.maxRetries = value;
  await config.save();
  return config;
}

async function setBackoffBase(value) {
  const config = await getConfig();
  config.backoffBase = value;
  await config.save();
  return config;
}

module.exports = { getConfig, setMaxRetries, setBackoffBase };
