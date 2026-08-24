const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const User = require("./models/user.js");
const Listing = require("./models/listing.js");
const wrapAsync = require("./utils/wrapAsync.js");
const { getSessionUserId, attachCsrf, csrfProtect } = require("./utils/auth.js");
const ExpressError = require("./utils/ExpressError.js");

const cors = require("cors");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const bookingRouter = require("./routes/booking.js");
const userRouter = require("./routes/user.js");
const wishlistRouter = require("./routes/wishlist.js");
const ragRouter = require("./routes/rag.js");


// CORS Configuration for Vite / React Frontend
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    credentials: true,
  })
);

// View Engine Setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body Parser & Static Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser(process.env.SESSION_SECRET || "wanderlustsecretkey"));

// Session Middleware & Cookie Options Configuration
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "wanderlustsecretkey",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
  },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// CSRF Protection
app.use(attachCsrf);
app.use(csrfProtect);

// Store Session & Flash Info in res.locals Middleware
app.use(async (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  if (req.user) {
    res.locals.currentUser = req.user;
  } else {
    const uid = getSessionUserId(req) || (req.session && req.session.userId);
    if (uid) {
      try {
        res.locals.currentUser = await User.findById(uid).select("-password").lean();
      } catch {
        res.locals.currentUser = null;
      }
    } else {
      res.locals.currentUser = null;
    }
  }
  next();
});

const { attachRatings } = require("./utils/rating.js");

// Home Route
app.get(
  "/",
  wrapAsync(async (req, res) => {
    const allListings = await Listing.find({}).lean();
    await attachRatings(allListings);

    const matchCategory = (cat, rx) =>
      allListings.filter(
        (l) => l.category === cat || rx.test(`${l.title} ${l.description} ${l.location} ${l.country}`)
      );

    const beachListings = matchCategory("beach", /beach|coast|ocean|island|malibu|cancun|bali|greece|maldives/i);
    const viewListings = matchCategory("amazing-views", /mountain|view|retreat|chalet|lodge|treehouse|banff|aspen|verbier|alps/i);
    const trendingListings = matchCategory("trending", /villa|penthouse|loft|downtown|historic|luxury|oasis|serengeti|florence|tuscany|tokyo|dubai/i);
    const lakeListings = matchCategory("lake", /lake|lakefront|lakeside|tahoe|hampshire/i);
    const countrysideListings = matchCategory("countryside", /countryside|cotswolds|charleston|cottage|village/i);
    const treehouseListings = matchCategory("treehouse", /treehouse|tree house|treetop|canopy|portland|costa rica/i);
    const cityListings = matchCategory("city", /city|downtown|loft|apartment|tokyo|new york|boston/i);
    const skiListings = matchCategory("ski", /ski|slope|snow|alpine|chalet|aspen|swiss|verbier/i);
    const castleListings = matchCategory("castle", /castle|fort|palace|highlands|scotland/i);
    const cabinListings = matchCategory("cabin", /cabin|log cabin|montana|tahoe/i);

    res.render("home.ejs", {
      featuredListings: allListings.slice(0, 8),
      beachListings,
      viewListings,
      trendingListings,
      lakeListings,
      countrysideListings,
      treehouseListings,
      cityListings,
      skiListings,
      castleListings,
      cabinListings,
    });
  })
);

app.use("/api/rag", ragRouter);


// Mount EJS Legacy Routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/bookings", bookingRouter);
app.use("/", userRouter);
app.use("/wishlist", wishlistRouter);
app.use("/rag", ragRouter);

// 404 Route Catch-All
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ error: "API Route Not Found" });
  }
  next(new ExpressError(404, "Page Not Found!"));
});

// Custom Error Handling Middleware
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  if (req.originalUrl && req.originalUrl.startsWith("/api/")) {
    return res.status(statusCode).json({ error: message });
  }
  res.status(statusCode).render("error.ejs", { err, message });
});

// Server Launcher
async function start({ port = process.env.PORT || 8080 } = {}) {
  const dbUrl = process.env.ATLASDB_URL || process.env.DB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbUrl);
  }
  const count = await Listing.countDocuments();
  if (count === 0) {
    const sampleData = require("./init/data.js");
    if (sampleData && sampleData.data && sampleData.data.length > 0) {
      await Listing.insertMany(sampleData.data);
      console.log(`Extracted and loaded ${sampleData.data.length} listings from init/data.js into database.`);
    }
  }
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const addr = server.address();
      const p = addr && typeof addr === "object" ? addr.port : port;
      console.log(`Server listening on port ${p}`);
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use by another process.`);
      } else {
        console.error("Server error:", err);
      }
      reject(err);
    });
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
