const mongoose = require("mongoose");
const schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  price: Number,
  location: String,
  image: {
    url: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
      set: (v) =>
        v === ""
          ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
          : v,
    },
    filename: {
      type: String,
      default: "listingimage",
    },
  },
  country: String,
  embedding: { type: [Number], default: undefined },
  embeddingModel: { type: String, default: undefined },
  reviews: [
    {
      type: schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: schema.Types.ObjectId,
    ref: "User",
  },
  category: {
    type: String,
    enum: [
      "trending",
      "amazing-views",
      "beach",
      "cabin",
      "countryside",
      "farm",
      "lake",
      "treehouse",
      "camping",
      "tiny",
      "island",
      "mansion",
      "castle",
      "luxury",
      "ski",
      "tropical",
      "city",
      "mountain",
      "nature",
    ],
    default: "trending",
  },
});

// Post middleware: Delete all associated reviews when a listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing && listing.reviews.length) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const listing = mongoose.model("listing", listingSchema);
module.exports = listing;
