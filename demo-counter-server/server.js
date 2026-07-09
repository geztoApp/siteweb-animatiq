const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 4001;
const DATA_FILE = path.join(__dirname, "counters.json");
const GAMES = ["caves-ouvertes", "chasse-aux-bonbons", "escalade-1602"];

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

const sendJson = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
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
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === "/" && req.method === "GET") {
    const counters = readCounters();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(counters));
    return;
  }

  if (url.pathname === "/counters" && req.method === "GET") {
    sendJson(res, 200, readCounters());
    return;
  }

  const playMatch = url.pathname.match(/^\/counters\/([a-z0-9-]+)\/play$/);
  if (playMatch && req.method === "POST") {
    const slug = playMatch[1];
    if (!GAMES.includes(slug)) {
      sendJson(res, 404, { error: "unknown game slug" });
      return;
    }
    incrementCounter(slug).then((counters) => sendJson(res, 200, counters));
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`Demo counter server running on http://localhost:${PORT}`);
});
