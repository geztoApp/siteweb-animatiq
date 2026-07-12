const fs = require("fs");
const path = require("path");
const { sendJson, getClientIp, readBody, createRateLimiter, escapeHtml } = require("./utils");
const { sendNotificationEmail } = require("./email");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LOG_FILE = path.join(DATA_DIR, "submissions.log");

const MAX_BODY_BYTES = 10 * 1024;
const MIN_HUMAN_FILL_TIME_MS = 2000;

const MAX_LENGTHS = {
  name: 100,
  email: 150,
  eventType: 100,
  concept: 20,
  message: 2000,
  source: 60,
};

const EVENT_TYPES = ["festival", "entreprise", "ecole", "commune", "association", "anniversaire", "autre", ""];
const CONCEPTS = ["village", "histoire", "metier", "edifice", "melange", "libre", ""];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// A real visitor never needs more than a handful of submissions per hour.
const isRateLimited = createRateLimiter(60 * 60 * 1000, 10);

// Strip characters that only matter for email/header-injection attacks
// (newlines collapse a multi-line field into one line, which is what any
// sane downstream use — log file, future email sending — wants anyway).
const sanitizeLine = (value) => String(value).replace(/[\r\n]+/g, " ").trim();

// eventType comes in as a single string from the plain contact form, or an
// array of strings from the request modal's multi-select pills. Normalizes
// both into one sanitized, comma-joined string; returns null if malformed.
const normalizeEventType = (value) => {
  if (Array.isArray(value)) {
    if (value.length > EVENT_TYPES.length) return null;
    const items = value.map((v) => (typeof v === "string" ? sanitizeLine(v) : ""));
    if (items.some((v) => !EVENT_TYPES.includes(v) || v === "")) return null;
    return [...new Set(items)].join(", ");
  }
  if (typeof value === "string") {
    const v = sanitizeLine(value);
    return EVENT_TYPES.includes(v) ? v : null;
  }
  return "";
};

const validateSubmission = (body) => {
  const name = typeof body.name === "string" ? sanitizeLine(body.name) : "";
  const email = typeof body.email === "string" ? sanitizeLine(body.email) : "";
  const eventType = normalizeEventType(body.eventType);
  const concept = typeof body.concept === "string" ? sanitizeLine(body.concept) : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const source = typeof body.source === "string" ? sanitizeLine(body.source) : "contact";

  if (!name || name.length > MAX_LENGTHS.name) return null;
  if (!email || email.length > MAX_LENGTHS.email || !isValidEmail(email)) return null;
  if (eventType === null || eventType.length > MAX_LENGTHS.eventType) return null;
  if (concept.length > MAX_LENGTHS.concept || !CONCEPTS.includes(concept)) return null;
  if (!message || message.length > MAX_LENGTHS.message) return null;
  if (source.length > MAX_LENGTHS.source) return null;

  return { name, email, eventType, concept, message, source };
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
        <div class="meta">${escapeHtml(s.receivedAt)} — ${escapeHtml(s.source)}${s.eventType ? " — " + escapeHtml(s.eventType) : ""}${s.concept ? " — " + escapeHtml(s.concept) : ""}</div>
        <div><span class="name">${escapeHtml(s.name)}</span> — ${escapeHtml(s.email)}</div>
        <div class="message">${escapeHtml(s.message)}</div>
      </div>`
      )
      .join("")}
  </body>
</html>`;

const handleApi = async (req, res, url) => {
  if (url.pathname !== "/api/submit" || req.method !== "POST") return false;

  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    sendJson(res, 429, { error: "Trop de requêtes. Réessayez plus tard." });
    return true;
  }

  let body;
  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (err) {
    const tooLarge = err && err.message === "payload too large";
    sendJson(res, tooLarge ? 413 : 400, { error: "Corps de requête invalide." });
    return true;
  }

  // Spam gets a silent "success" — never tip off a bot that it was caught.
  if (looksLikeSpam(body)) {
    sendJson(res, 200, { ok: true });
    return true;
  }

  const submission = validateSubmission(body);
  if (!submission) {
    sendJson(res, 400, { error: "Champs manquants ou invalides." });
    return true;
  }

  try {
    appendSubmission({ ...submission, ip });
  } catch (err) {
    sendJson(res, 500, { error: "Impossible d'enregistrer la demande." });
    return true;
  }

  // Fire-and-forget: the submission is already durably logged above, so an
  // email hiccup must not delay or fail the visitor-facing response.
  sendNotificationEmail(submission);

  sendJson(res, 200, { ok: true });
  return true;
};

const handleAdmin = (req, res, url) => {
  if (url.pathname === "/admin/submissions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHtml(readSubmissions(100)));
    return true;
  }
  return false;
};

module.exports = { handleApi, handleAdmin };
