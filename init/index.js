require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const dbUrl = process.env.ATLASDB_URL || process.env.DB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB:", dbUrl.includes("mongodb+srv") ? "MongoDB Atlas (Cloud)" : "Local MongoDB");
}

const initDB = async () => {
  await Listing.deleteMany({});
  await Listing.insertMany(initData.data);
  console.log("Database initialized with sample data");
};

main()
  .then(() => initDB())
  .then(() => {
    console.log("Seeding complete!");
    mongoose.connection.close();
  })
  .catch((err) => {
    console.log("Error:", err);
    mongoose.connection.close();
  });
