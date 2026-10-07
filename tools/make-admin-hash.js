import crypto from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Verwendung: node tools/make-admin-hash.js <Passwort>\nDas Passwort sollte mindestens 12 Zeichen lang sein.");
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
console.log(`scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`);
