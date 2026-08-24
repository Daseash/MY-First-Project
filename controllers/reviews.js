const listing = require("../models/listing.js");
const Review = require("../models/review.js");
const ExpressError = require("../utils/ExpressError.js");
const { getSessionUserId } = require("../utils/auth.js");

// Create Review Controller
module.exports.createReview = async (req, res) => {
  let Listing = await listing.findById(req.params.id);
  if (!Listing) {
    req.flash("error", "Listing Not Found!");
    return res.redirect("/listings");
  }
  let newReview = new Review(req.body.review);
  newReview.author = req.user ? req.user._id : getSessionUserId(req);
  Listing.reviews.push(newReview);

  await newReview.save();
  await Listing.save();

  req.flash("success", "New Review Created!");
  res.redirect(`/listings/${Listing._id}`);
};

// Destroy Review Controller
module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;

  await listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Review Deleted!");
  res.redirect(`/listings/${id}`);
};
