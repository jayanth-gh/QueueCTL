require('dotenv').config();
const mongoose = require('mongoose');

let isConnected = false;

// Every CLI invocation is a short-lived process, so we connect once
// per command run. Guarding with isConnected avoids double-connecting
// if a command path accidentally calls this twice.
async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/queuectl';
  await mongoose.connect(uri);
  isConnected = true;
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connectDB, disconnectDB };
