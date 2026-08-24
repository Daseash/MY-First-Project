const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongooseRaw = require("passport-local-mongoose");
const passportLocalMongoose =
  typeof passportLocalMongooseRaw === "function"
    ? passportLocalMongooseRaw
    : passportLocalMongooseRaw.default || passportLocalMongooseRaw;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    default: "",
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "listing",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Plugin Passport-Local-Mongoose to automatically add username, salted & hashed password fields
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
