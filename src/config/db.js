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
  });
  isConnected = true;
}

module.exports = { connectDatabase };
