const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in your .env file or Render environment variables.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000
  });

  console.log('[db] Connected to MongoDB Atlas');

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
  });
}

module.exports = connectDB;
