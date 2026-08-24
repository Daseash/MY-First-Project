const Booking = require("../models/booking.js");
const listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const { getSessionUserId } = require("../utils/auth.js");

const CLEANING_RATE = 0.08;
const SERVICE_RATE = 0.12;

// Normalize an HTML date string ("YYYY-MM-DD") to a UTC Date at midnight.
function dateFromInput(value) {
  const d = new Date(String(value).slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

// Server-side price calculation (also used by the booking card preview).
function computeBookingPrice(pricePerNight, nights) {
  const subtotal = nights * pricePerNight;
  const cleaningFee = Math.round(subtotal * CLEANING_RATE);
  const serviceFee = Math.round(subtotal * SERVICE_RATE);
  const total = subtotal + cleaningFee + serviceFee;
  return { subtotal, cleaningFee, serviceFee, total };
}

// Confirmed bookings that overlap a [checkIn, checkOut) window for a listing.
async function overlappingBookings(listingId, checkIn, checkOut, excludeId) {
  const query = {
    listing: listingId,
    status: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.find(query).lean();
}

// All confirmed date ranges for a listing (used by the show page + RAG).
async function bookedRangesForListing(listingId) {
  const bookings = await Booking.find({
    listing: listingId,
    status: "confirmed",
    checkOut: { $gt: new Date() },
  })
    .select("checkIn checkOut")
    .lean();
  return bookings.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut }));
}

// Create a booking. All pricing is computed server-side; the client total is
// never trusted.
module.exports.createBooking = async (req, res) => {
  const uid = getSessionUserId(req);
  if (!uid) {
    throw new ExpressError(401, "Please log in to book a stay.");
  }

  const { listingId, checkIn, checkOut, guests } = req.body;
  const Listing = await listing.findById(listingId);
  if (!Listing) throw new ExpressError(404, "Listing Not Found!");

  const start = dateFromInput(checkIn);
  const end = dateFromInput(checkOut);
  if (!start || !end) {
    throw new ExpressError(400, "Please select valid check-in and check-out dates.");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (start < today) {
    throw new ExpressError(400, "Check-in cannot be in the past.");
  }
  if (end <= start) {
    throw new ExpressError(400, "Check-out must be after check-in.");
  }

  const guestCount = Math.max(1, Math.min(16, parseInt(guests, 10) || 1));
  const nights = daysBetween(start, end);
  if (nights < 1) {
    throw new ExpressError(400, "A stay must be at least 1 night.");
  }

  const overlap = await overlappingBookings(Listing._id, start, end);
  if (overlap.length > 0) {
    const b = overlap[0];
    req.flash("error", "Selected dates overlap with an existing booking!");
    return res.redirect(
      `/listings/${Listing._id}?error=dates&from=${b.checkIn
        .toISOString()
        .slice(0, 10)}&to=${b.checkOut.toISOString().slice(0, 10)}`
    );
  }

  const pricePerNight = Number(Listing.price) || 0;
  const { subtotal, cleaningFee, serviceFee, total } = computeBookingPrice(pricePerNight, nights);

  const newBooking = new Booking({
    user: uid,
    listing: Listing._id,
    checkIn: start,
    checkOut: end,
    guests: guestCount,
    nights,
    pricePerNight,
    subtotal,
    cleaningFee,
    serviceFee,
    total,
  });
  await newBooking.save();

  req.flash("success", "Booking confirmed! Have a great trip.");
  res.redirect("/bookings?booked=1");
};

// My Trips — the logged-in user's bookings (future = upcoming, rest = past).
module.exports.myTrips = async (req, res) => {
  const uid = getSessionUserId(req);
  if (!uid) throw new ExpressError(401, "Please log in.");

  const bookings = await Booking.find({ user: uid })
    .populate("listing")
    .sort({ checkIn: -1 })
    .lean();

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.checkOut > now
  );
  const past = bookings.filter((b) => !upcoming.includes(b));
  res.render("bookings/my-trips", {
    pageTitle: "My Trips & Reservations — WanderLust",
    bookings,
    upcoming,
    past,
    justBooked: req.query.booked === "1",
    cancelled: req.query.cancelled === "1",
  });
};

// Cancel a booking (owner only).
module.exports.cancelBooking = async (req, res) => {
  const uid = getSessionUserId(req);
  if (!uid) throw new ExpressError(401, "Please log in.");

  const booking = await Booking.findOne({ _id: req.params.id, user: uid });
  if (!booking) {
    req.flash("error", "Booking Not Found!");
    return res.redirect("/bookings");
  }
  if (booking.status === "cancelled") {
    req.flash("error", "This booking is already cancelled.");
    return res.redirect("/bookings");
  }
  booking.status = "cancelled";
  await booking.save();
  req.flash("success", "Booking has been cancelled.");
  res.redirect("/bookings?cancelled=1");
};

module.exports.bookedRangesForListing = bookedRangesForListing;
module.exports.dateFromInput = dateFromInput;
module.exports.daysBetween = daysBetween;
module.exports.computeBookingPrice = computeBookingPrice;