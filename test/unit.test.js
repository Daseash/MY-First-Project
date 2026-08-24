const test = require("node:test");
const assert = require("node:assert");
const { parseQueryFilters } = require("../rag/filterParser.js");
const { computeBookingPrice, dateFromInput, daysBetween } = require("../controllers/bookings.js");

test("parses a max price with a currency symbol", () => {
  const f = parseQueryFilters("find a villa with a pool in goa under 200");
  assert.strictEqual(f.maxPrice, 200);
});

test("parses 'under' without a symbol", () => {
  assert.strictEqual(parseQueryFilters("stays under 1500 per night").maxPrice, 1500);
});

test("parses an explicit price range", () => {
  const f = parseQueryFilters("villa between 1000 and 2000");
  assert.strictEqual(f.minPrice, 1000);
  assert.strictEqual(f.maxPrice, 2000);
});

test("parses a minimum price", () => {
  assert.strictEqual(parseQueryFilters("luxury stays above 5000").minPrice, 5000);
});

test("parses guest count", () => {
  assert.strictEqual(parseQueryFilters("a place for 5 guests in phuket").minGuests, 5);
});

test("captures a real destination", () => {
  assert.strictEqual(parseQueryFilters("stays in new york with a pool").location, "new york");
});

test("does not treat descriptive words as a destination", () => {
  assert.strictEqual(parseQueryFilters("villa in mountains").location, undefined);
  assert.strictEqual(parseQueryFilters("cottage by the beach").location, undefined);
});

test("extracts amenities only when the user explicitly asks", () => {
  const withPool = parseQueryFilters("house with a private pool");
  assert.ok(withPool.amenities && withPool.amenities.length > 0);
  const soft = parseQueryFilters("beachfront villa");
  assert.strictEqual(soft.amenities, undefined);
});

test("extracts property type", () => {
  assert.strictEqual(parseQueryFilters("a pet friendly villa").propertyType, "villa");
});

test("computeBookingPrice applies 8% cleaning + 12% service fees", () => {
  const p = computeBookingPrice(1500, 4);
  assert.strictEqual(p.subtotal, 6000);
  assert.strictEqual(p.cleaningFee, 480);   // 8% of 6000
  assert.strictEqual(p.serviceFee, 720);    // 12% of 6000
  assert.strictEqual(p.total, 7200);
});

test("computeBookingPrice is zero-safe", () => {
  const p = computeBookingPrice(0, 3);
  assert.deepStrictEqual(p, { subtotal: 0, cleaningFee: 0, serviceFee: 0, total: 0 });
});

test("dateFromInput normalizes HTML dates to UTC midnight", () => {
  const d = dateFromInput("2026-09-10");
  assert.ok(d);
  assert.strictEqual(d.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.strictEqual(dateFromInput("garbage"), null);
  assert.strictEqual(dateFromInput(""), null);
});

test("daysBetween counts nights correctly", () => {
  const a = dateFromInput("2026-09-10");
  const b = dateFromInput("2026-09-14");
  assert.strictEqual(daysBetween(a, b), 4);
});