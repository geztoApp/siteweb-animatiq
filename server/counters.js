const fs = require("fs");
const path = require("path");
const { sendJson, getClientIp, createRateLimiter } = require("./utils");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, "counters.json");
const GAMES = ["caves-ouvertes", "chasse-aux-bonbons", "escalade-1602"];

// Increments are cheap (no paid API involved), but still worth rate limiting
// so a scripted flood can't silently falsify the public play counts.
const isRateLimited = createRateLimiter(60 * 60 * 1000, 30);

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

const handleApi = async (req, res, url) => {
  if (url.pathname === "/api/counters" && req.method === "GET") {
    sendJson(res, 200, readCounters());
    return true;
  }

  const playMatch = url.pathname.match(/^\/api\/counters\/([a-z0-9-]+)\/play$/);
  if (playMatch && req.method === "POST") {
    if (isRateLimited(getClientIp(req))) {
      sendJson(res, 429, { error: "Trop de requêtes. Réessayez plus tard." });
      return true;
    }

    const slug = playMatch[1];
    if (!GAMES.includes(slug)) {
      sendJson(res, 404, { error: "unknown game slug" });
      return true;
    }

    const counters = await incrementCounter(slug);
    sendJson(res, 200, counters);
    return true;
  }

  return false;
};

const handleAdmin = (req, res, url) => {
  if (url.pathname === "/admin/counters" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(readCounters()));
    return true;
  }
  return false;
};

module.exports = { handleApi, handleAdmin };
