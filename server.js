import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const TEST_CHECKIN_MODE = false;
const dbPath = process.env.DB_PATH || path.join(__dirname, "gipfelpass.sqlite");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recovery_hash TEXT,
  is_kid INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  UNIQUE(user_id, target_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Migration for databases created by older prototype versions.
try { db.exec("ALTER TABLE users ADD COLUMN recovery_hash TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN is_kid INTEGER NOT NULL DEFAULT 0"); } catch {}
// Privacy migration: remove legacy exact GPS values from prototype databases.
try { db.exec("UPDATE stamps SET latitude=NULL, longitude=NULL, accuracy=NULL"); } catch {}
// Existing guestbook entries from the former moderation workflow are published by default.
try { db.exec("UPDATE guestbook SET status='approved' WHERE status='pending'"); } catch {}

const targets = JSON.parse(fs.readFileSync(path.join(publicDir, "data.json"), "utf8"));
const isProduction = process.env.NODE_ENV === "production";
const SESSION_DAYS = 180;
const STAMP_RADIUS_METERS = 200;
const rateBuckets = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const LIMITS = {
  adminLoginIp: 8,
  recoveryIp: 6,
  recoveryName: 5,
  createIp: 10,
  stampUser: 30,
  guestbookUser: 8,
  guestbookIp: 20
};

function clientIp(req) {
  // Only trust X-Forwarded-For when explicitly enabled behind a trusted reverse proxy.
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || "unknown";
}
function normalizeNickname(value) { return String(value || "").trim().toLowerCase(); }
function rateLimit(key, limit) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > limit ? Math.ceil((bucket.startedAt + RATE_WINDOW_MS - now) / 1000) : 0;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of rateBuckets) if (now - b.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now')").run();
}, 10 * 60 * 1000).unref();

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function newToken() { return crypto.randomBytes(32).toString("base64url"); }
function cookieHeader(name, value, maxAge) {
  const secure = isProduction ? "; Secure" : "";
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function startSession(userId, res) {
  const token = newToken();
  const hash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)").run(userId, hash, expires);
  res.setHeader("Set-Cookie", cookieHeader("gp_session", token, SESSION_DAYS * 86400));
}
function clearSession(req, res) {
  const token = parseCookies(req).gp_session;
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha256(token));
  res.setHeader("Set-Cookie", cookieHeader("gp_session", "", 0));
}
function json(res, code, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = "", size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > 32 * 1024) { req.destroy(); reject(Object.assign(new Error("request too large"), { statusCode: 413 })); return; }
      s += c;
    });
    req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error("invalid json")); } });
    req.on("error", reject);
  });
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function user(req, res) {
  const token = parseCookies(req).gp_session;
  if (!token) { json(res, 401, { error: "Bitte zuerst ein Profil anlegen oder wiederherstellen." }); return null; }
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).get(sha256(token));
  if (!row) { json(res, 401, { error: "Deine Sitzung ist abgelaufen. Bitte den Wanderpass wiederherstellen." }); return null; }
  db.prepare("UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?").run(sha256(token));
  return row;
}
function passwordHash(password, salt = crypto.randomBytes(16)) {
  const derived = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}
function verifyPassword(password, encoded) {
  try {
    const [algo,n,r,p,saltText,hashText] = String(encoded || "").split("$");
    if (algo !== "scrypt" || Number(n) !== 16384 || Number(r) !== 8 || Number(p) !== 1) return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024 });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}
function startAdminSession(res) {
  const token = newToken();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)").run(sha256(token), expires);
  res.setHeader("Set-Cookie", cookieHeader("gp_admin", token, 8 * 60 * 60));
}
function clearAdminSession(req, res) {
  const token = parseCookies(req).gp_admin;
  if (token) db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(sha256(token));
  res.setHeader("Set-Cookie", cookieHeader("gp_admin", "", 0));
}
function admin(req, res) {
  const token = parseCookies(req).gp_admin;
  if (!token) { json(res, 401, { error: "Bitte zuerst im Admin-Bereich anmelden." }); return false; }
  const row = db.prepare("SELECT id FROM admin_sessions WHERE token_hash=? AND expires_at > datetime('now')").get(sha256(token));
  if (!row) { json(res, 401, { error: "Die Admin-Sitzung ist abgelaufen. Bitte erneut anmelden." }); return false; }
  db.prepare("UPDATE admin_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?").run(sha256(token));
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(self)");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && url.pathname.startsWith("/api/") && !sameOrigin(req))
      return json(res, 403, { error: "Ungültige Herkunft der Anfrage." });

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      if (req.method === "POST" && url.pathname === "/api/admin/login") {
 
return json(res, 200, {
reached: true
});
 
const retry = rateLimit(`admin:login:${clientIp(req)}`, LIMITS.adminLoginIp);
 
// ...
}
      const retry = rateLimit(`admin:login:${clientIp(req)}`, LIMITS.adminLoginIp);
      if (retry) return json(res, 429, { error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen.", retryAfter: retry });
      const b = await body(req);
    
      const configuredUser = process.env.ADMIN_USER;
      const configuredHash = process.env.ADMIN_PASSWORD_HASH;
      
      if (!configuredUser || !configuredHash) return json(res, 503, { error: "Admin-Zugang ist auf dem Server nicht vollständig konfiguriert." });
      const username = String(b.username || "").trim();
      const password = String(b.password || "");
      if (username.length > 100 || password.length > 200 || username !== configuredUser || !verifyPassword(password, configuredHash))
        return json(res, 401, { error: "Benutzername oder Passwort ist nicht korrekt." });
      startAdminSession(res);
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      clearAdminSession(req, res);
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true });

    if (req.method === "GET" && url.pathname === "/api/targets") return json(res, 200, targets);

    if (req.method === "POST" && url.pathname === "/api/users") {
      const retry = rateLimit(`create:ip:${clientIp(req)}`, LIMITS.createIp);
      if (retry) return json(res, 429, { error: "Zu viele Profilversuche. Bitte später erneut versuchen.", retryAfter: retry });
      const b = await body(req);
      const nickname = String(b.nickname || "").trim().slice(0, 24);
            if (nickname.length < 2) return json(res, 400, { error: "Bitte einen Spitznamen mit mindestens 2 Zeichen wählen." });
      const recovery = crypto.randomBytes(10).toString("hex").toUpperCase();
      const hash = sha256(recovery);
      try {
        const info = db.prepare("INSERT INTO users(nickname,recovery_hash) VALUES(?,?)").run(nickname, hash);
        startSession(info.lastInsertRowid, res);
        return json(res, 201, { id: info.lastInsertRowid, nickname, recoveryCode: recovery });
      } catch { return json(res, 409, { error: "Dieser Spitzname ist bereits vergeben." }); }
    }

    if (req.method === "POST" && url.pathname === "/api/recover") {
      const b = await body(req);
      const nickname = String(b.nickname || "").trim().slice(0, 24);
      const code = String(b.recoveryCode || "").replace(/[\s-]/g, "").toUpperCase();
      if (!nickname || !code) return json(res, 400, { error: "Bitte Spitzname und Sicherungscode eingeben." });
      const ip = clientIp(req);
      const retry = Math.max(rateLimit(`recover:ip:${ip}`, LIMITS.recoveryIp), rateLimit(`recover:name:${normalizeNickname(nickname)}`, LIMITS.recoveryName));
      if (retry) return json(res, 429, { error: "Zu viele Wiederherstellungsversuche. Bitte später erneut versuchen.", retryAfter: retry });
      const u = db.prepare("SELECT id,nickname FROM users WHERE nickname=? AND recovery_hash=?").get(nickname, sha256(code));
      if (!u) return json(res, 401, { error: "Spitzname oder Sicherungscode ist nicht korrekt." });
      startSession(u.id, res);
      return json(res, 200, { id: u.id, nickname: u.nickname });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      clearSession(req, res);
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const u = user(req, res); if (!u) return;
      const stamps = db.prepare("SELECT target_id,collected_at FROM stamps WHERE user_id=? ORDER BY collected_at").all(u.id);
      return json(res, 200, { user: { id: u.id, nickname: u.nickname }, stamps, testMode: TEST_CHECKIN_MODE });
    }

    if (TEST_CHECKIN_MODE && req.method === "POST" && url.pathname === "/api/stamps/test") {
      const u = user(req, res); if (!u) return;
      const retry = rateLimit(`teststamp:user:${u.id}`, LIMITS.stampUser);
      if (retry) return json(res, 429, { error: "Zu viele Test-Stempel. Bitte etwas später erneut versuchen.", retryAfter: retry });
      const b = await body(req);
      const target = targets.find(x => x.id === b.targetId);
      if (!target) return json(res, 400, { error: "Unbekanntes Stempelziel." });
      const existing = db.prepare("SELECT id FROM stamps WHERE user_id=? AND target_id=?").get(u.id, target.id);
      if (!existing) db.prepare("INSERT OR IGNORE INTO stamps(user_id,target_id) VALUES(?,?)").run(u.id, target.id);
      const count = db.prepare("SELECT COUNT(*) c FROM stamps WHERE user_id=?").get(u.id).c;
      return json(res, 200, { ok: true, count, testMode: true });
    }

    if (req.method === "POST" && url.pathname === "/api/stamps") {
      const u = user(req, res); if (!u) return;
      const retry = rateLimit(`stamp:user:${u.id}`, LIMITS.stampUser);
      if (retry) return json(res, 429, { error: "Zu viele Stempelprüfungen. Bitte etwas später erneut versuchen.", retryAfter: retry });
      const b = await body(req); const target = targets.find(x => x.id === b.targetId);
      if (!target) return json(res, 400, { error: "Unbekanntes Stempelziel." });
      const lat = Number(b.latitude), lon = Number(b.longitude), accuracy = Number(b.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000)
        return json(res, 400, { error: "Ungültige Standortdaten." });
      const existing = db.prepare("SELECT id FROM stamps WHERE user_id=? AND target_id=?").get(u.id, target.id);
      if (!existing) {
        // Server-side plausibility check: the client must be inside the configured radius.
        const d = distanceMeters(lat, lon, target.lat, target.lon);
        const allowed = STAMP_RADIUS_METERS;
        if (d > allowed) return json(res, 400, { error: "Standort liegt außerhalb des Stempelbereichs." });
        db.prepare("INSERT OR IGNORE INTO stamps(user_id,target_id) VALUES(?,?)").run(u.id, target.id);
      }
      const count = db.prepare("SELECT COUNT(*) c FROM stamps WHERE user_id=?").get(u.id).c;
      return json(res, 200, { ok: true, count });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!admin(req, res)) return;
      if (req.method === "GET" && url.pathname === "/api/admin/overview") {
        const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
        const hikers = db.prepare("SELECT COUNT(DISTINCT user_id) c FROM stamps").get().c;
        const stamps = db.prepare("SELECT COUNT(*) c FROM stamps").get().c;
        const entries = db.prepare("SELECT COUNT(*) c FROM guestbook").get().c;
        const hidden = db.prepare("SELECT COUNT(*) c FROM guestbook WHERE status IN ('hidden','rejected')").get().c;
        return json(res, 200, { users, hikers, stamps, entries, hidden, targets });
      }
      if (req.method === "PUT" && url.pathname === "/api/admin/targets") {
        const b = await body(req); const t = targets.find(x => x.id === b.id);
        if (!t) return json(res, 404, { error: "Ziel nicht gefunden." });
        for (const k of ["name","height","level","levelLabel","description","lat","lon","gpsRadius","gpxUrl"]) if (b[k] !== undefined) t[k] = b[k];
        fs.writeFileSync(path.join(publicDir, "data.json"), JSON.stringify(targets, null, 2), "utf8");
        return json(res, 200, t);
      }
      if (req.method === "GET" && url.pathname === "/api/admin/export.csv") {
        const users = db.prepare("SELECT id,nickname,created_at FROM users ORDER BY id").all();
        const stamps = db.prepare("SELECT s.user_id,u.nickname,s.target_id,s.collected_at FROM stamps s JOIN users u ON u.id=s.user_id ORDER BY s.collected_at").all();
        const entries = db.prepare("SELECT g.id,g.user_id,u.nickname,g.target_id,g.text,g.status,g.created_at FROM guestbook g JOIN users u ON u.id=g.user_id ORDER BY g.created_at").all();
        const rows = [["Typ","ID","Nutzer-ID","Spitzname","Stempelziel","Zeitpunkt","Status","Text"]];
        for(const u of users) rows.push(["Profil",u.id,"",u.nickname,"",u.created_at,"",""]);
        for(const st of stamps) rows.push(["Stempel","",st.user_id,st.nickname,st.target_id,st.collected_at,"",""]);
        for(const e of entries) rows.push(["Gipfelbuch",e.id,e.user_id,e.nickname,e.target_id,e.created_at,e.status,e.text]);
        const csv="\ufeff"+rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
        res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=\"gipfelpass-export.csv\"","Cache-Control":"no-store"});
        return res.end(csv);
      }
      if (req.method === "GET" && url.pathname === "/api/admin/guestbook") {
        const rows = db.prepare(`SELECT g.id,g.target_id,g.text,g.status,g.created_at,u.nickname FROM guestbook g JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 200`).all();
        return json(res, 200, rows);
      }
      if (req.method === "PATCH" && url.pathname === "/api/admin/guestbook") {
        const b = await body(req);
        if (!["approved","pending","hidden","rejected"].includes(b.status)) return json(res, 400, { error: "Ungültiger Status." });
        db.prepare("UPDATE guestbook SET status=? WHERE id=?").run(b.status, Number(b.id));
        return json(res, 200, { ok: true });
      }
      if (req.method === "DELETE" && url.pathname === "/api/admin/guestbook") {
        const b = await body(req);
        const id = Number(b.id);
        if (!Number.isInteger(id) || id <= 0) return json(res, 400, { error: "Ungültige Eintrags-ID." });
        const info = db.prepare("DELETE FROM guestbook WHERE id=?").run(id);
        if (!info.changes) return json(res, 404, { error: "Eintrag nicht gefunden." });
        return json(res, 200, { ok: true });
      }
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/tours/") && url.pathname.endsWith("/gpx")) {
      const id = decodeURIComponent(url.pathname.slice("/api/tours/".length, -"/gpx".length));
      const target = targets.find(x => x.id === id);
      if (!target || !target.gpxUrl) return json(res, 404, { error: "GPX-Track nicht gefunden." });
      try {
        const r = await fetch(target.gpxUrl, { headers: { "User-Agent": "Wanderpass-Ammergauer-Alpen/0.27" } });
        if (!r.ok) return json(res, 502, { error: "GPX-Track konnte nicht geladen werden." });
        const xml = await r.text();
        if (!xml.includes("<gpx") && !xml.includes(":gpx")) return json(res, 502, { error: "Ungültige GPX-Antwort." });
        res.writeHead(200, { "Content-Type": "application/gpx+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" });
        return res.end(xml);
      } catch {
        return json(res, 502, { error: "GPX-Track ist momentan nicht erreichbar." });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/guestbook") {
      const targetId = url.searchParams.get("targetId");
      const rows = targetId
        ? db.prepare(`SELECT g.id,g.target_id,g.text,g.created_at,u.nickname FROM guestbook g JOIN users u ON u.id=g.user_id WHERE g.status='approved' AND g.target_id=? ORDER BY g.created_at DESC LIMIT 50`).all(targetId)
        : db.prepare(`SELECT g.id,g.target_id,g.text,g.created_at,u.nickname FROM guestbook g JOIN users u ON u.id=g.user_id WHERE g.status='approved' ORDER BY g.created_at DESC LIMIT 50`).all();
      return json(res, 200, rows);
    }

    if (req.method === "POST" && url.pathname === "/api/guestbook") {
      const u = user(req, res); if (!u) return;
      const ip = clientIp(req);
      const retry = Math.max(rateLimit(`book:user:${u.id}`, LIMITS.guestbookUser), rateLimit(`book:ip:${ip}`, LIMITS.guestbookIp));
      if (retry) return json(res, 429, { error: "Zu viele Einträge. Bitte später erneut versuchen.", retryAfter: retry });
      const b = await body(req), targetId = String(b.targetId || "");
      const text = String(b.text || "").trim().slice(0, 600);
      if (!targets.some(x => x.id === targetId)) return json(res, 400, { error: "Unbekanntes Stempelziel." });
      if (text.length < 3) return json(res, 400, { error: "Bitte mindestens 3 Zeichen schreiben." });
      const hasStamp = db.prepare("SELECT id FROM stamps WHERE user_id=? AND target_id=?").get(u.id, targetId);
      if (!hasStamp) return json(res, 403, { error: "Für dieses Gipfelbuch brauchst du zuerst den passenden Stempel." });
      const info = db.prepare("INSERT INTO guestbook(user_id,target_id,text,status) VALUES(?,?,?,'approved')").run(u.id, targetId, text);
      return json(res, 201, { id: info.lastInsertRowid, status: "pending" });
    }

    if (req.method === "GET" && url.pathname === "/vendor/leaflet.js") return serveFile(res, path.join(__dirname,"node_modules/leaflet/dist/leaflet.js"), "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/vendor/leaflet.css") return serveFile(res, path.join(__dirname,"node_modules/leaflet/dist/leaflet.css"), "text/css; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/vendor/maplibre-gl.js") return serveFile(res, path.join(__dirname,"node_modules/maplibre-gl/dist/maplibre-gl.js"), "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/vendor/maplibre-gl.css") return serveFile(res, path.join(__dirname,"node_modules/maplibre-gl/dist/maplibre-gl.css"), "text/css; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/vendor/pmtiles.js") return serveFile(res, path.join(__dirname,"node_modules/pmtiles/dist/pmtiles.js"), "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/vendor/basemaps.js") return serveFile(res, path.join(__dirname,"node_modules/@protomaps/basemaps/dist/basemaps.js"), "text/javascript; charset=utf-8");

    if (req.method === "HEAD") {
      let p = url.pathname === "/admin" ? "/admin.html" : url.pathname;
      if (p === "/") p = "/index.html";
      const file = path.normalize(path.join(publicDir, p));
      if (!file.startsWith(publicDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res,404,{error:"Nicht gefunden"});
      const ext = path.extname(file).toLowerCase();
      const types = { ".pmtiles":"application/octet-stream", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".html":"text/html; charset=utf-8" };
      res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Content-Length":fs.statSync(file).size,"Accept-Ranges":"bytes"});
      return res.end();
    }

    if (req.method === "GET") {
      const aliases = { "/impressum":"/impressum.html", "/datenschutz":"/datenschutz.html", "/rechtliches":"/rechtliches.html" };
      let p = url.pathname === "/admin" ? "/admin.html" : (aliases[url.pathname] || url.pathname);
      if (p === "/") p = "/index.html";
      const file = path.normalize(path.join(publicDir, p));
      if (!file.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { error: "Nicht gefunden" });
      const ext = path.extname(file).toLowerCase();
      const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json", ".jpg":"image/jpeg", ".png":"image/png", ".svg":"image/svg+xml", ".pmtiles":"application/octet-stream" };
      const stat=fs.statSync(file);
      const range=req.headers.range;
      if(ext===".pmtiles" && range){
        const m=/bytes=(\d+)-(\d*)/.exec(range);
        if(m){
          const start=Number(m[1]), end=m[2]?Number(m[2]):stat.size-1;
          if(start<=end && start<stat.size){
            const safeEnd=Math.min(end,stat.size-1);
            res.writeHead(206,{"Content-Type":types[ext],"Content-Range":`bytes ${start}-${safeEnd}/${stat.size}`,"Accept-Ranges":"bytes","Content-Length":safeEnd-start+1,"Cache-Control":"public, max-age=86400"});
            return fs.createReadStream(file,{start,end:safeEnd}).pipe(res);
          }
        }
      }
      res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Content-Length":stat.size,...(ext===".pmtiles"?{"Accept-Ranges":"bytes"}:{}),"Cache-Control":ext===".html"?"no-cache":"public, max-age=86400"});
      return fs.createReadStream(file).pipe(res);
    }
    json(res, 404, { error: "Nicht gefunden" });
  } catch (e) {
    console.error(e);
    json(res, e.statusCode || 500, { error: "Interner Serverfehler." });
  }
});

function serveFile(res,file,type){
  if(!fs.existsSync(file)) return json(res,404,{error:"Nicht gefunden"});
  res.writeHead(200,{"Content-Type":type,"Cache-Control":"public, max-age=31536000, immutable"});
  return fs.createReadStream(file).pipe(res);
}

function distanceMeters(a,b,c,d){
  const R=6371000, r=Math.PI/180, x=(c-a)*r, y=(d-b)*r;
  const z=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;
  return 2*R*Math.asin(Math.sqrt(z));
}

const port = Number(process.env.PORT || 8081);
server.listen(port, () => console.log(`Wanderpass läuft auf Port ${port}`));

function shutdown(signal) {
  console.log(`${signal}: Server wird beendet …`);
  server.close(() => { try { db.close(); } finally { process.exit(0); } });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
