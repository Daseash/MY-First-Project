const User = require("../models/user.js");
const { login, logout } = require("../utils/auth.js");
const { sendOtpNotification } = require("../utils/mailer.js");

// Render Signup Form
module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs", {
    pageTitle: "Sign Up — WanderLust",
    next: req.query.next || "",
  });
};

// Process Signup
module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body.user;

    let existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      req.flash("error", "Username or Email already registered!");
      return res.redirect("/signup");
    }

    let newUser = new User({ username, email });
    let registeredUser = await User.register(newUser, password);

    login(res, registeredUser._id);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to WanderLust!");
      let redirectUrl = res.locals.redirectUrl || req.body.next || "/listings";
      res.redirect(redirectUrl);
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

// Render Login Form
module.exports.renderLoginForm = (req, res) => {
  if (req.query.next) {
    req.session.redirectUrl = req.query.next;
  }
  res.render("users/login.ejs", {
    pageTitle: "Sign In — WanderLust",
    next: req.session.redirectUrl || req.query.next || "",
  });
};

// Process Login
module.exports.login = async (req, res) => {
  if (req.user) {
    login(res, req.user._id);
  }
  req.flash("success", "Welcome back to WanderLust!");
  let redirectUrl = res.locals.redirectUrl || req.body.next || "/listings";
  delete req.session.redirectUrl;
  res.redirect(redirectUrl);
};

// Generate & Send OTP
module.exports.sendOtp = async (req, res) => {
  let { email, phone } = req.body;

  if (!email || !phone) {
    return res.status(400).json({
      success: false,
      message: "Both Email address and Phone number are required.",
    });
  }

  email = email.trim().toLowerCase();
  phone = phone.trim();

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  if (phone.replace(/\D/g, "").length < 7) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid phone number.",
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  let user = await User.findOne({ $or: [{ email }, { phone }] });

  if (!user) {
    let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    if (!baseUsername) baseUsername = "user";
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter++}`;
    }

    user = new User({
      email,
      phone,
      username,
      otp: code,
      otpExpires,
    });
    await User.register(user, Math.random().toString(36).slice(-8));
  } else {
    user.email = email;
    user.phone = phone;
    user.otp = code;
    user.otpExpires = otpExpires;
    await user.save();
  }

  await sendOtpNotification({ email, phone, otp: code });

  res.json({
    success: true,
    message: `A 6-digit verification code has been dispatched to ${email} and ${phone}.`,
    email,
    phone,
  });
};

// Verify OTP & Sign In
module.exports.verifyOtp = async (req, res, next) => {
  let { email, phone, otp, next: nextUrl } = req.body;
  if ((!email && !phone) || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email/Phone and 6-digit OTP are required.",
    });
  }

  email = (email || "").trim().toLowerCase();
  phone = (phone || "").trim();
  otp = otp.trim();

  let query = [];
  if (email) query.push({ email });
  if (phone) query.push({ phone });

  let user = await User.findOne({ $or: query });

  if (!user || !user.otp || user.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP code. Please check and try again.",
    });
  }

  if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
    return res.status(400).json({
      success: false,
      message: "OTP code has expired. Please request a new OTP.",
    });
  }

  user.otp = null;
  user.otpExpires = null;
  await user.save();

  login(res, user._id);
  req.login(user, (err) => {
    if (err) return next(err);
    res.json({
      success: true,
      message: "Authentication successful!",
      redirectUrl: nextUrl || "/listings",
    });
  });
};

// Logout
module.exports.logout = (req, res, next) => {
  logout(res);
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have logged out successfully.");
    res.redirect("/listings");
  });
};
