import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, hotp, totp, verifyTotp } from "../src/lib/totp";

// RFC 6238 test secret: ASCII "12345678901234567890"
const SECRET_ASCII = "12345678901234567890";
const SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("base32 decode matches the RFC secret", () => {
  assert.equal(base32Decode(SECRET_B32).toString("ascii"), SECRET_ASCII);
});

test("RFC 6238 SHA-1 test vectors (6-digit truncation)", () => {
  const secret = base32Decode(SECRET_B32);
  // T=59 -> counter 1 -> full code 94287082 -> 287082
  assert.equal(hotp(secret, 1), "287082");
  // T=1111111109 -> 07081804 -> 081804
  assert.equal(totp(SECRET_B32, 1111111109), "081804");
  // T=1234567890 -> 89005924 -> 005924
  assert.equal(totp(SECRET_B32, 1234567890), "005924");
});

test("verifyTotp accepts neighbouring steps, rejects others", () => {
  const at = 1111111109;
  const code = totp(SECRET_B32, at);
  assert.equal(verifyTotp(SECRET_B32, code, at), true);
  assert.equal(verifyTotp(SECRET_B32, code, at + 30), true); // one step of drift
  assert.equal(verifyTotp(SECRET_B32, code, at + 120), false);
  assert.equal(verifyTotp(SECRET_B32, "000000", at), false);
  assert.equal(verifyTotp(SECRET_B32, "abc", at), false);
});
