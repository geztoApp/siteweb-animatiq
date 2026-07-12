const sendJson = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
};

// Reads the body while enforcing a byte-size cap. Keeps consuming the stream
// until it ends naturally even once over the cap, so the client still gets a
// clean 413 response instead of a reset connection.
const readBody = (req, maxBytes) =>
  new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
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

// In-memory per-IP rate limiter. Resets on restart, which is fine for abuse
// limits (not billing-grade accounting) on a single-process server.
const createRateLimiter = (windowMs, maxRequests) => {
  const log = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of log) {
      const fresh = timestamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) log.delete(ip);
      else log.set(ip, fresh);
    }
  }, windowMs).unref();

  return (ip) => {
    const now = Date.now();
    const timestamps = (log.get(ip) || []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    log.set(ip, timestamps);
    return timestamps.length > maxRequests;
  };
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

module.exports = { sendJson, getClientIp, readBody, createRateLimiter, escapeHtml };
