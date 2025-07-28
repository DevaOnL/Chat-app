import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    // MongoDB connection options
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(mongoURI, options);
    
    console.log('✅ MongoDB connected successfully');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected gracefully');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
};
