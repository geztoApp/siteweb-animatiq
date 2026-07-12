const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 4003;
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LOG_FILE = path.join(DATA_DIR, "submissions.log");

// Comma-separated list of origins allowed to call this API. Falls back to
// "*" (any origin) only if left unset — set this in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10; // per IP, per window — a real visitor never needs more
const MAX_BODY_BYTES = 10 * 1024;
const MIN_HUMAN_FILL_TIME_MS = 2000;

const MAX_LENGTHS = {
  name: 100,
  email: 150,
  eventType: 30,
  message: 2000,
  source: 60,
};

const EVENT_TYPES = ["festival", "entreprise", "ecole", "commune", "association", "anniversaire", "autre", ""];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        data = "";
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(new Error("payload too large"));
        return;
      }
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

// Strip characters that only matter for email/header-injection attacks
// (newlines collapse a multi-line field into one line, which is what any
// sane downstream use — log file, future email sending — wants anyway).
const sanitizeLine = (value) => String(value).replace(/[\r\n]+/g, " ").trim();

const validateSubmission = (body) => {
  const name = typeof body.name === "string" ? sanitizeLine(body.name) : "";
  const email = typeof body.email === "string" ? sanitizeLine(body.email) : "";
  const eventType = typeof body.eventType === "string" ? sanitizeLine(body.eventType) : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const source = typeof body.source === "string" ? sanitizeLine(body.source) : "contact";

  if (!name || name.length > MAX_LENGTHS.name) return null;
  if (!email || email.length > MAX_LENGTHS.email || !isValidEmail(email)) return null;
  if (eventType.length > MAX_LENGTHS.eventType || !EVENT_TYPES.includes(eventType)) return null;
  if (!message || message.length > MAX_LENGTHS.message) return null;
  if (source.length > MAX_LENGTHS.source) return null;

  return { name, email, eventType, message, source };
};

// A honeypot field bots often fill in, plus a minimum time-on-form check —
// both re-verified here server-side, since a bot can always skip the
// client-side JavaScript entirely and POST straight to this endpoint.
const looksLikeSpam = (body) => {
  if (typeof body.company === "string" && body.company.trim() !== "") return true;
  if (typeof body.shownAt === "number" && Date.now() - body.shownAt < MIN_HUMAN_FILL_TIME_MS) return true;
  return false;
};

const appendSubmission = (entry) => {
  const line = JSON.stringify({ ...entry, receivedAt: new Date().toISOString() });
  fs.appendFileSync(LOG_FILE, line + "\n");
};

const readSubmissions = (limit) => {
  try {
    const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderHtml = (submissions) => `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Demandes reçues</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0c1d32; color: #fff; padding: 40px; }
      h1 { font-size: 1.2rem; }
      .entry { border-bottom: 1px solid rgba(255,255,255,.15); padding: 16px 0; }
      .entry:last-child { border-bottom: none; }
      .meta { color: rgba(255,255,255,.5); font-size: .8rem; margin-bottom: 6px; }
      .name { color: #ffd54f; font-weight: 700; }
      .message { margin-top: 8px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>📬 Demandes reçues (${submissions.length} dernières)</h1>
    ${submissions
      .map(
        (s) => `
      <div class="entry">
        <div class="meta">${escapeHtml(s.receivedAt)} — ${escapeHtml(s.source)}${s.eventType ? " — " + escapeHtml(s.eventType) : ""}</div>
        <div><span class="name">${escapeHtml(s.name)}</span> — ${escapeHtml(s.email)}</div>
        <div class="message">${escapeHtml(s.message)}</div>
      </div>`
      )
      .join("")}
  </body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {}, req);
    return;
  }

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(readSubmissions(100)));
    return;
  }

  if (url.pathname === "/submit" && req.method === "POST") {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      sendJson(res, 429, { error: "Trop de requêtes. Réessayez plus tard." }, req);
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      const tooLarge = err && err.message === "payload too large";
      sendJson(res, tooLarge ? 413 : 400, { error: "Corps de requête invalide." }, req);
      return;
    }

    // Spam gets a silent "success" — never tip off a bot that it was caught.
    if (looksLikeSpam(body)) {
      sendJson(res, 200, { ok: true }, req);
      return;
    }

    const submission = validateSubmission(body);
    if (!submission) {
      sendJson(res, 400, { error: "Champs manquants ou invalides." }, req);
      return;
    }

    try {
      appendSubmission({ ...submission, ip });
    } catch (err) {
      sendJson(res, 500, { error: "Impossible d'enregistrer la demande." }, req);
      return;
    }

    sendJson(res, 200, { ok: true }, req);
    return;
  }

  sendJson(res, 404, { error: "not found" }, req);
});

server.listen(PORT, () => {
  console.log(`Contact server running on http://localhost:${PORT}`);
});
