const User = require("../models/user.js");
const listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const { getSessionUserId } = require("../utils/auth.js");

function currentUser(req) {
  const uid = getSessionUserId(req);
  return uid ? User.findById(uid) : null;
}

// Wishlist page — the user's saved listings.
module.exports.index = async (req, res) => {
  const user = await currentUser(req);
  if (!user) throw new ExpressError(401, "Please log in.");

  const userPopulated = await user.populate({
    path: "wishlist",
    options: { sort: { _id: -1 } },
  });
  res.render("wishlist/index", {
    pageTitle: "My Wishlist — WanderLust",
    savedListings: userPopulated.wishlist || [],
  });
};

// Toggle a listing in/out of the wishlist.
module.exports.toggle = async (req, res) => {
  const user = await currentUser(req);
  if (!user) throw new ExpressError(401, "Please log in.");

  const Listing = await listing.findById(req.params.id);
  if (!Listing) throw new ExpressError(404, "Listing Not Found!");

  const id = Listing._id;
  const has = user.wishlist.some((x) => String(x) === String(id));
  if (has) {
    user.wishlist.pull(id);
  } else {
    user.wishlist.push(id);
  }
  await user.save();

  const referer = req.get("referer") || "/listings";
  res.redirect(referer);
};