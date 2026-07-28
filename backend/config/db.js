const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set. Copy backend/.env.example to backend/.env and configure it.');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    // If MongoDB is unreachable, fail (and error out) quickly instead of the
    // request hanging on the client — this is what made "Send Message" and
    // other form submissions appear to spin forever with no response.
    mongoose.set('bufferTimeoutMS', 8000);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 20000
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected — API requests that touch the database will fail until it reconnects.');
    });
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;