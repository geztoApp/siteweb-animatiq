const http = require("http");
const fs = require("fs");
const path = require("path");

const counters = require("./server/counters");
const chat = require("./server/chat");
const contact = require("./server/contact");

const PORT = process.env.PORT || 80;
const ROOT = __dirname;
const ASSETS_ROOT = path.join(ROOT, "assets");

// Only these top-level files (plus anything under assets/) are ever served —
// nothing else in the repo (server source, .env, .git, data/) is reachable
// over HTTP.
const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const serveFile = (res, absolutePath) => {
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(absolutePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
};

const tryServeStatic = (req, res, url) => {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const relativePath = STATIC_FILES[url.pathname];
  if (relativePath) {
    serveFile(res, path.join(ROOT, relativePath));
    return true;
  }

  if (url.pathname.startsWith("/assets/")) {
    // Resolve and confirm the path stays inside assets/ to block traversal
    // attempts like /assets/../server.js.
    const requested = path.normalize(path.join(ROOT, url.pathname));
    if (
      (requested === ASSETS_ROOT || requested.startsWith(ASSETS_ROOT + path.sep)) &&
      fs.existsSync(requested) &&
      fs.statSync(requested).isFile()
    ) {
      serveFile(res, requested);
      return true;
    }
  }

  return false;
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    if (await counters.handleApi(req, res, url)) return;
    if (await chat.handleApi(req, res, url)) return;
    if (await contact.handleApi(req, res, url)) return;
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (url.pathname.startsWith("/admin/")) {
    if (counters.handleAdmin(req, res, url)) return;
    if (contact.handleAdmin(req, res, url)) return;
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  if (tryServeStatic(req, res, url)) return;

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`AnimatiQ server running on http://localhost:${PORT}`);
});
