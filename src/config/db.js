const mongoose = require("mongoose");

let isConnected = false;

async function connectDatabase() {
  if (isConnected) {
    return;
  }

  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is missing in backend .env");
  }

  await mongoose.connect(mongodbUri, {
    dbName: process.env.MONGODB_DB || "tools_app",
    serverSelectionTimeoutMS: 5000,   // fail fast if Atlas unreachable
    connectTimeoutMS: 10000,          // max time to open socket
    socketTimeoutMS: 45000,           // max time for individual operation
    maxPoolSize: 10,                  // maintain up to 10 reusable connections
    minPoolSize: 2,                   // keep 2 connections warm at all times
  });
  isConnected = true;
}

module.exports = { connectDatabase };
