const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
  console.log("Connected to MongoDB");
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
