const ExpressError = require("./utils/ExpressError.js");
const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const { getSessionUserId, csrfProtect } = require("./utils/auth.js");

module.exports.csrfProtect = csrfProtect;

// Middleware to check if user is authenticated via Passport req.isAuthenticated() method
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to create or modify a listing!");
    return res.redirect("/login");
  }
  next();
};

// Also export as requireLogin for backwards compatibility with existing route imports
module.exports.requireLogin = module.exports.isLoggedIn;

// Middleware to save redirect URL to res.locals before Passport login clears session
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

// Authorization Middleware: Check if logged-in user is the owner of the listing
module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listingItem = await Listing.findById(id);
  if (!listingItem) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  const currUserId = req.user ? req.user._id : getSessionUserId(req);
  if (listingItem.owner && currUserId && !listingItem.owner.equals(currUserId)) {
    req.flash("error", "You do not have permission to edit or delete this listing!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// Authorization Middleware: Check if logged-in user is the author of the review
module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review) {
    req.flash("error", "Review not found!");
    return res.redirect(`/listings/${id}`);
  }
  const currUserId = req.user ? req.user._id : getSessionUserId(req);
  if (review.author && currUserId && !review.author.equals(currUserId)) {
    req.flash("error", "You do not have permission to delete this review!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  if (!req.body || !req.body.listing) {
    throw new ExpressError(400, "Send valid data for listing");
  }
  const { title, price, location, country } = req.body.listing;
  if (!title || !price || !location || !country) {
    throw new ExpressError(400, "Title, price, location, and country are required.");
  }
  next();
};

module.exports.validateUser = (req, res, next) => {
  if (!req.body || !req.body.user) {
    throw new ExpressError(400, "Send valid data for user");
  }
  const { username, email, password } = req.body.user;
  if (!username || !email || !password) {
    throw new ExpressError(400, "Username, email, and password are required.");
  }
  next();
};

module.exports.validateReview = (req, res, next) => {
  if (!req.body || !req.body.review) {
    throw new ExpressError(400, "Send valid data for review");
  }
  const { rating, comment } = req.body.review;
  if (!rating || !comment) {
    throw new ExpressError(400, "Rating and comment are required.");
  }
  next();
};
