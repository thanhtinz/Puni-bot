/**
 * Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s step) for the owner
 * admin panel's second factor. Implemented from the spec — no
 * dependency — and verified against the RFC test vectors in tests.
 */
import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Khoá TOTP không phải base32 hợp lệ.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function totp(secretBase32: string, atSec?: number): string {
  const at = atSec ?? Math.floor(Date.now() / 1000);
  return hotp(base32Decode(secretBase32), Math.floor(at / 30));
}

/** Accept the current step plus one step either side (clock drift). */
export function verifyTotp(secretBase32: string, code: string, atSec?: number): boolean {
  const clean = (code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const at = atSec ?? Math.floor(Date.now() / 1000);
  const secret = base32Decode(secretBase32);
  const step = Math.floor(at / 30);
  for (const delta of [-1, 0, 1]) {
    if (hotp(secret, step + delta) === clean) return true;
  }
  return false;
}
