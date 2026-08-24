const test = require("node:test");
const assert = require("node:assert");

// Point the app at a throwaway database and skip the (slow) RAG warm-up.
process.env.DB_URL = "mongodb://127.0.0.1:27017/wanderlust_test";
process.env.SKIP_RAG = "1";

const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const Booking = require("../models/booking.js");
const User = require("../models/user.js");
const { start } = require("../app.js");

let server;
let base;

const jar = new Map();
function storeCookies(res) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const line of setCookie) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function request(path, { method = "GET", body, type = "application/x-www-form-urlencoded" } = {}) {
  const headers = { cookie: cookieHeader() };
  if (body) headers["content-type"] = type;
  const res = await fetch(base + path, { method, headers, body, redirect: "manual" });
  storeCookies(res);
  return res;
}

const csrfFrom = (html) => {
  const m = html.match(/name="_csrf" value="([^"]+)"/);
  return m ? m[1] : "";
};

async function resetDb() {
  await Promise.all([
    Listing.deleteMany({}),
    Booking.deleteMany({}),
    User.deleteMany({}),
    Review.deleteMany({}),
  ]);
}

let listing;

test.before(async () => {
  await mongoose.connect(process.env.DB_URL);
  await resetDb();
  server = await start({ port: 0 });
  base = `http://127.0.0.1:${server.address().port}`;
  listing = await Listing.create({
    title: "Test Lake House",
    description: "A cozy lakeside retreat.",
    price: 1500,
    location: "Nainital",
    country: "India",
  });
});

test.after(async () => {
  await resetDb();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test("home and listings pages render", async () => {
  const home = await request("/");
  assert.strictEqual(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /Find a place to stay/);

  const index = await request("/listings");
  assert.strictEqual(index.status, 200);
  const indexHtml = await index.text();
  assert.match(indexHtml, /Test Lake House/);
});

test("listings index shows 'New' when there are no reviews, then real rating", async () => {
  const index = await request("/listings");
  const before = await index.text();
  assert.match(before, /New/);

  const r1 = await Review.create({ comment: "Loved it", rating: 5 });
  const r2 = await Review.create({ comment: "Great", rating: 4 });
  listing.reviews.push(r1._id, r2._id);
  await listing.save();

  const after = await (await request("/listings")).text();
  assert.match(after, /4\.5/);
});

test("show page renders map + booking card", async () => {
  const res = await request(`/listings/${listing._id}`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();
  assert.match(html, /stay-map/);
  assert.match(html, /Reserve/);
});

test("signup → wishlist → booking → cancel flow works end to end", async () => {
  const page = await request("/signup");
  assert.strictEqual(page.status, 200);
  const tok = csrfFrom(await page.text());
  assert.ok(tok, "signup form exposes a CSRF token");

  const signup = await request("/signup", {
    method: "POST",
    body: `user[username]=tester&user[email]=tester@example.com&user[password]=secret123&_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(signup.status, 302);

  const toggle = await request(`/wishlist/${listing._id}/toggle`, {
    method: "POST",
    body: `_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(toggle.status, 302);

  const wishlist = await request("/wishlist");
  assert.strictEqual(wishlist.status, 200);
  assert.match(await wishlist.text(), /Test Lake House/);

  const create = await request("/bookings", {
    method: "POST",
    body: `listingId=${listing._id}&checkIn=2026-09-10&checkOut=2026-09-14&guests=2&_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(create.status, 302);

  const saved = await Booking.findOne({ listing: listing._id }).lean();
  assert.ok(saved, "booking persisted");
  assert.strictEqual(saved.nights, 4);
  assert.strictEqual(saved.subtotal, 6000);
  assert.strictEqual(saved.cleaningFee, 480);
  assert.strictEqual(saved.serviceFee, 720);
  assert.strictEqual(saved.total, 7200);
  assert.strictEqual(saved.status, "confirmed");

  const trips = await request("/bookings");
  assert.strictEqual(trips.status, 200);
  assert.match(await trips.text(), /Test Lake House/);

  const cancel = await request(`/bookings/${saved._id}/cancel`, {
    method: "POST",
    body: `_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(cancel.status, 302);
  const after = await Booking.findById(saved._id).lean();
  assert.strictEqual(after.status, "cancelled");
});

test("overlapping confirmed bookings are rejected", async () => {
  const tok = csrfFrom(await (await request("/signup")).text());
  const first = await request("/bookings", {
    method: "POST",
    body: `listingId=${listing._id}&checkIn=2026-11-01&checkOut=2026-11-05&guests=1&_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(first.status, 302);

  const overlap = await request("/bookings", {
    method: "POST",
    body: `listingId=${listing._id}&checkIn=2026-11-03&checkOut=2026-11-06&guests=1&_csrf=${encodeURIComponent(tok)}`,
  });
  assert.strictEqual(overlap.status, 302);
  assert.match(overlap.headers.get("location"), /error=dates/);
});

test("CSRF is enforced on state-changing requests", async () => {
  const res = await request("/signup", {
    method: "POST",
    body: "user[username]=no&user[email]=no@example.com&user[password]=secret123",
  });
  assert.strictEqual(res.status, 403);
});

test("RAG route validates input", async () => {
  const res = await request("/rag/ask", {
    method: "POST",
    type: "application/json",
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});