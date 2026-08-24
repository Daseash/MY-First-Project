const test = require("node:test");
const assert = require("node:assert");
const { hashPassword, verifyPassword, getSessionUserId } = require("../utils/auth.js");
const cookieParser = require("cookie-parser");

test("hashPassword produces scrypt$salt$hash format", () => {
  const hash = hashPassword("secret123");
  const parts = hash.split("$");
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[0], "scrypt");
  assert.ok(parts[1].length === 32, "salt is 32 hex chars");
  assert.ok(parts[2].length === 128, "hash is 64 bytes = 128 hex chars");
});

test("verifyPassword accepts the correct password", () => {
  const hash = hashPassword("correct horse battery staple");
  assert.ok(verifyPassword("correct horse battery staple", hash));
});

test("verifyPassword rejects a wrong password", () => {
  const hash = hashPassword("secret123");
  assert.strictEqual(verifyPassword("wrong", hash), false);
});

test("same password always gets a unique salt (different hash)", () => {
  const a = hashPassword("abc");
  const b = hashPassword("abc");
  assert.notStrictEqual(a, b);
  assert.ok(verifyPassword("abc", a));
  assert.ok(verifyPassword("abc", b));
});

test("verifyPassword rejects malformed stored values", () => {
  assert.strictEqual(verifyPassword("x", ""), false);
  assert.strictEqual(verifyPassword("x", "not-a-scrypt-hash"), false);
  assert.strictEqual(verifyPassword("x", "scrypt$short"), false);
});

// getSessionUserId reads req.signedCookies.sess. We verify a tampered cookie
// is rejected (cookieParser resolves an unsigned/mismatched value to `false`).
function signedReq(rawCookie, secret) {
  const req = { headers: rawCookie ? { cookie: `sess=${rawCookie}` } : {} };
  cookieParser(secret)(req, {}, () => {});
  return req;
}

test("getSessionUserId returns null when no session cookie", () => {
  assert.strictEqual(getSessionUserId(signedReq(null, "secret")), null);
});

test("getSessionUserId rejects a tampered signature", () => {
  const { login } = require("../utils/auth.js");
  const res = {
    cookie(name, value) {
      this._cookie = value;
    },
  };
  login(res, "507f1f77bcf86cd799439011");
  // Flip one character of the signed payload before replaying.
  const tampered = res._cookie.slice(0, -3) + (res._cookie.endsWith("aba") ? "xyz" : "aba");
  assert.strictEqual(getSessionUserId(signedReq(tampered, "secret")), null);
});
