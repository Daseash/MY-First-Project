const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { requireLogin, csrfProtect } = require("../middleware.js");
const wishlistController = require("../controllers/wishlist.js");

// Wishlist Index Route
router
  .route("/")
  .get(requireLogin, wrapAsync(wishlistController.index));

// Toggle Listing in Wishlist
router
  .route("/:id/toggle")
  .post(requireLogin, csrfProtect, wrapAsync(wishlistController.toggle));

module.exports = router;