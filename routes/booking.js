const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { requireLogin, csrfProtect } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

// Bookings Index (GET My Trips) and Create (POST)
router
  .route("/")
  .get(requireLogin, wrapAsync(bookingController.myTrips))
  .post(requireLogin, csrfProtect, wrapAsync(bookingController.createBooking));

// Cancel a booking
router
  .route("/:id/cancel")
  .post(requireLogin, csrfProtect, wrapAsync(bookingController.cancelBooking));

module.exports = router;