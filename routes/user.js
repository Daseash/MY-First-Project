const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync.js");
const userController = require("../controllers/users.js");
const { validateUser, saveRedirectUrl } = require("../middleware.js");

// Signup Route (GET & POST)
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(validateUser, wrapAsync(userController.signup));

// Login Route (GET & POST)
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: "Invalid username or password!",
    }),
    wrapAsync(userController.login)
  );

// OTP Routes for fast verification
router.post("/send-otp", wrapAsync(userController.sendOtp));
router.post("/verify-otp", wrapAsync(userController.verifyOtp));

// Logout Route
router.get("/logout", userController.logout);

module.exports = router;