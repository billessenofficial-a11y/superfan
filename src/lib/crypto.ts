import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { encryptionKey, signingSecret } from "./env";

/* ───────────────────────── Encoding ───────────────────────── */

export function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function fromBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/* ───────────────────────── Hashing ───────────────────────── */

/** SHA-256 hex digest. Used for storing token hashes instead of tokens. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic id for events without a provider event id. */
export function deterministicId(parts: (string | number | null | undefined)[]): string {
  return sha256(parts.map((p) => (p === undefined || p === null ? "" : String(p))).join("|")).slice(0, 40);
}

/* ───────────────────────── Random ───────────────────────── */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly code without ambiguous characters (0/O, 1/I). */
export function randomCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/* ───────────────────────── Signed tokens ───────────────────────── */

export type SignedPayload = Record<string, unknown> & { exp?: number };

/**
 * Compact HMAC-SHA256 signed token: base64url(json).base64url(sig).
 * Used for check-in QR codes, claim links and the local dev session cookie.
 */
export function signToken(payload: SignedPayload, secret = signingSecret()): string {
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export type VerifyResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyToken<T extends SignedPayload>(
  token: string,
  secret = signingSecret(),
): VerifyResult<T> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  let payload: T;
  try {
    payload = JSON.parse(fromBase64url(body).toString("utf8")) as T;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

/* ───────────────────────── Encryption at rest ───────────────────────── */

function keyBuffer(): Buffer {
  const hex = encryptionKey();
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("SUPERFAN_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters");
  }
  return buf;
}

/** AES-256-GCM. Output format: v1.iv.ciphertext.tag (all base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", base64url(iv), base64url(enc), base64url(tag)].join(".");
}

export function decryptSecret(ciphertext: string): string {
  const [version, ivB, encB, tagB] = ciphertext.split(".");
  if (version !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", keyBuffer(), fromBase64url(ivB));
  decipher.setAuthTag(fromBase64url(tagB));
  return Buffer.concat([decipher.update(fromBase64url(encB)), decipher.final()]).toString("utf8");
}

/* ───────────────────────── Webhook signatures ───────────────────────── */

/** Shopify: HMAC-SHA256 of raw body, base64, in X-Shopify-Hmac-Sha256. */
export function verifyShopifyHmac(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Meta: "sha256=<hex>" of raw body in X-Hub-Signature-256. */
export function verifyMetaSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(header.slice("sha256=".length));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** TikTok: HMAC-SHA256 of "<timestamp>.<body>" in the TikTok-Signature header (t=...,s=...). */
export function verifyTikTokSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.trim().split("=") as [string, string]),
  );
  if (!parts.t || !parts.s) return false;
  const digest = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(parts.s);
  return a.length === b.length && timingSafeEqual(a, b);
}
