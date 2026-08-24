const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const listingController = require("../controllers/listings.js");
const { validateListing, isLoggedIn, isOwner } = require("../middleware.js");
const { upload } = require("../cloudConfig.js");

// Index (GET) and Create (POST) Routes
router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// Render New Listing Form Route
router.get("/new", isLoggedIn, listingController.renderNewForm);

// Show (GET), Update (PUT), and Delete (DELETE) Routes
router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  );

// Render Edit Listing Form Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

module.exports = router;
