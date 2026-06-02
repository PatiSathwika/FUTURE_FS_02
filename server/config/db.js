// server/config/db.js

// Import mongoose for MongoDB object modeling
const mongoose = require('mongoose');

// -----------------------------------------------
// connectDB — Async function to connect to MongoDB
// Called once from server.js at startup
// -----------------------------------------------
const connectDB = async () => {
  try {
    // mongoose.connect() returns a promise
    // process.env.MONGO_URI is loaded from .env via dotenv in server.js
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings in newer Mongoose versions
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Log the host we connected to (e.g., localhost or Atlas cluster URL)
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

  } catch (error) {
    // Log the full error message for debugging
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    // Exit the Node process with failure code 1
    // This prevents the server from running without a DB connection
    process.exit(1);
  }
};

// -----------------------------------------------
// Mongoose Connection Event Listeners
// These fire on the global mongoose connection object
// Useful for monitoring connection state in production
// -----------------------------------------------

// Fires when mongoose loses connection to MongoDB
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB Disconnected');
});

// Fires when mongoose successfully reconnects
mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB Reconnected');
});

// Graceful shutdown — close DB connection when Node process ends
// SIGINT = Ctrl+C in terminal
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});

// Export so server.js can call connectDB()
module.exports = connectDB;