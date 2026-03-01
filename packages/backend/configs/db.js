import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URL) {
      console.warn("MONGODB_URL is missing from environment variables. Running without MongoDB connection.");
      return;
    }
    
    mongoose.connection.on("connected", () =>
      console.log("Database connected")
    );
    
    // Ensure we specifically use the "motionmeet" database
    const dbUri = process.env.MONGODB_URL;
    let finalUri = dbUri;
    
    if (dbUri.includes('?')) {
        const parts = dbUri.split('?');
        finalUri = `${parts[0].replace(/\/$/, '')}/motionmeet?${parts[1]}`;
    } else {
        finalUri = `${dbUri.replace(/\/$/, '')}/motionmeet`;
    }
    
    await mongoose.connect(finalUri);
  } catch (error) {
    console.log(error.message);
  }
};

export default connectDB;