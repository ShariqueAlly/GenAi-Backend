const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("connected to database");
  } catch (err) {
    console.error("error connecting to database", err);
    throw err;
  }
};

module.exports = connectDB;
