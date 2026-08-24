const listing = require("../models/listing.js");
const User = require("../models/user.js");
const ExpressError = require("../utils/ExpressError.js");
const { getSessionUserId } = require("../utils/auth.js");
const { refreshListingChunks, removeListingChunks } = require("../rag/sync.js");
const { bookedRangesForListing } = require("./bookings.js");
const { attachRatings } = require("../utils/rating.js");

// Wishlist ids for the logged-in user, if any.
async function wishlistIdsFor(req) {
  const uid = getSessionUserId(req);
  if (!uid) return new Set();
  const user = await User.findById(uid).select("wishlist").lean();
  return new Set((user && user.wishlist || []).map((x) => String(x)));
}

// Index Controller — keyword + price-range + sort + (optional) date/guest hints.
module.exports.index = async (req, res) => {
  const {
    search = "",
    category = "",
    checkin = "",
    checkout = "",
    guests = "",
    minPrice = "",
    maxPrice = "",
    sort = "",
  } = req.query;

  const query = {};
  if (category && category !== "all") {
    const catClean = category.replace(/[^a-zA-Z0-9-]/g, "");
    const kwRegex = new RegExp(catClean.replace(/-/g, "|"), "i");
    query.$or = [
      { category: catClean },
      { title: kwRegex },
      { description: kwRegex },
      { location: kwRegex },
      { country: kwRegex },
    ];
  }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const searchClause = {
      $or: [
        { title: rx },
        { description: rx },
        { location: rx },
        { country: rx },
        { category: rx },
      ],
    };
    if (query.$or) {
      query.$and = [{ $or: query.$or }, searchClause];
      delete query.$or;
    } else {
      query.$or = searchClause.$or;
    }
  }
  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (Number.isFinite(min) && min > 0) query.price = { $gte: min };
  if (Number.isFinite(max) && max > 0) query.price = { ...(query.price || {}), $lte: max };

  let cursor = listing.find(query);
  if (sort === "price_asc") cursor = cursor.sort({ price: 1 });
  else if (sort === "price_desc") cursor = cursor.sort({ price: -1 });
  else if (sort === "newest") cursor = cursor.sort({ _id: -1 });

  const allListings = await cursor;
  await attachRatings(allListings);
  const wishlistSet = await wishlistIdsFor(req);
  res.render("listings/index", {
    allListings,
    searchTerm: search,
    selectedCategory: category,
    checkin,
    checkout,
    guests,
    filters: { minPrice: minPrice, maxPrice: maxPrice, sort },
    wishlistSet,
  });
};

// Render New Listing Form Controller
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new", {
    pageTitle: "Add a New Stay — Become a Host | WanderLust",
  });
};

// Show Listing Controller — details, reviews, availability, wishlist state.
module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const Listing = await listing
    .findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!Listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }
  const bookedRanges = await bookedRangesForListing(id);
  const wishlistSet = await wishlistIdsFor(req);
  const err = req.query.error || "";
  const defaultCheckIn = req.query.from || "";
  const defaultCheckOut = req.query.to || "";

  const similar = await listing
    .find({ _id: { $ne: Listing._id }, country: Listing.country })
    .limit(5);
  await attachRatings(similar);

  res.render("listings/show", {
    pageTitle: `${Listing.title} — ${Listing.location}, ${Listing.country} | Voyager`,
    Listing,
    bookedRanges,
    wishlistSet,
    err,
    defaultCheckIn,
    defaultCheckOut,
    similarListings: similar,
  });
};

// Create Listing Controller - Save new listing with owner and image upload
module.exports.createListing = async (req, res) => {
  let listingData = req.body.listing || {};
  let newListing = new listing(listingData);
  newListing.owner = req.user ? req.user._id : getSessionUserId(req);

  if (req.file) {
    let url = req.file.path && req.file.path.startsWith("http")
      ? req.file.path
      : `/uploads/${req.file.filename}`;
    let filename = req.file.filename;
    newListing.image = { url, filename };
  } else if (typeof listingData.image === "string" && listingData.image.trim()) {
    newListing.image = { url: listingData.image.trim(), filename: "listingimage" };
  }

  await newListing.save();
  await refreshListingChunks(newListing);
  req.flash("success", "New Stay Created Successfully!");
  res.redirect(`/listings/${newListing._id}`);
};

// Render Edit Listing Form Controller
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const Listing = await listing.findById(id);
  if (!Listing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/edit", { Listing });
};

// Update Listing Controller - Modify listing and image upload
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listingData = req.body.listing || {};
  let currentListing = await listing.findById(id);
  if (!currentListing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }

  // Update fields
  Object.keys(listingData).forEach((key) => {
    if (key !== "image") currentListing[key] = listingData[key];
  });

  if (req.file) {
    let url = req.file.path && req.file.path.startsWith("http")
      ? req.file.path
      : `/uploads/${req.file.filename}`;
    let filename = req.file.filename;
    currentListing.image = { url, filename };
  } else if (typeof listingData.image === "string" && listingData.image.trim()) {
    currentListing.image = { url: listingData.image.trim(), filename: "listingimage" };
  }

  const updated = await currentListing.save();
  if (updated) await refreshListingChunks(updated);
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

// Destroy Listing Controller - Delete listing & cascade delete reviews
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await listing.findByIdAndDelete(id);
  if (!deletedListing) {
    req.flash("error", "Listing you requested does not exist!");
    return res.redirect("/listings");
  }
  removeListingChunks(id);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};