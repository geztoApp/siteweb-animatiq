const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 4001;
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, "counters.json");
const GAMES = ["caves-ouvertes", "chasse-aux-bonbons", "escalade-1602"];

// Comma-separated list of origins allowed to call this API. Falls back to
// "*" (any origin) only if left unset — set this in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Increments are cheap (no paid API involved), but still worth rate limiting
// so a scripted flood can't silently falsify the public play counts.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 30; // per IP, per window, for the play endpoint

const readCounters = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return Object.fromEntries(GAMES.map((slug) => [slug, 0]));
  }
};

let writing = Promise.resolve();

const incrementCounter = (slug) => {
  writing = writing.then(() => {
    const counters = readCounters();
    counters[slug] = (counters[slug] || 0) + 1;
    fs.writeFileSync(DATA_FILE, JSON.stringify(counters, null, 2));
    return counters;
  });
  return writing;
};

const requestLog = new Map(); // ip -> array of timestamps

const isRateLimited = (ip) => {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
};

const resolveAllowedOrigin = (req) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] || "";
};

const sendJson = (res, status, body, req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req) headers["Access-Control-Allow-Origin"] = resolveAllowedOrigin(req);
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const renderHtml = (counters) => `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Compteur des démos</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0c1d32; color: #fff; padding: 40px; }
      h1 { font-size: 1.2rem; }
      table { border-collapse: collapse; margin-top: 16px; }
      td, th { padding: 8px 20px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.15); }
      strong { color: #ffd54f; font-size: 1.4rem; }
    </style>
  </head>
  <body>
    <h1>🎮 Démos jouées</h1>
    <table>
      <tr><th>Jeu</th><th>Parties</th></tr>
      ${GAMES.map((slug) => `<tr><td>${slug}</td><td><strong>${counters[slug] || 0}</strong></td></tr>`).join("")}
    </table>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {}, req);
    return;
  }

  if (url.pathname === "/" && req.method === "GET") {
    const counters = readCounters();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(counters));
    return;
  }

  if (url.pathname === "/counters" && req.method === "GET") {
    sendJson(res, 200, readCounters(), req);
    return;
  }

  const playMatch = url.pathname.match(/^\/counters\/([a-z0-9-]+)\/play$/);
  if (playMatch && req.method === "POST") {
    if (isRateLimited(getClientIp(req))) {
      sendJson(res, 429, { error: "Trop de requêtes. Réessayez plus tard." }, req);
      return;
    }

    const slug = playMatch[1];
    if (!GAMES.includes(slug)) {
      sendJson(res, 404, { error: "unknown game slug" }, req);
      return;
    }
    incrementCounter(slug).then((counters) => sendJson(res, 200, counters, req));
    return;
  }

  sendJson(res, 404, { error: "not found" }, req);
});

server.listen(PORT, () => {
  console.log(`Demo counter server running on http://localhost:${PORT}`);
});
