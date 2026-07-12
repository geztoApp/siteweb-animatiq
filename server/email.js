const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const RESEND_TO = process.env.RESEND_TO || "gezto.app@gmail.com";
const RESEND_TIMEOUT_MS = 10000;

// Best-effort notification on top of the submissions log (the source of
// truth). Never throws — a Resend outage or misconfiguration must not block
// a visitor's submission from being saved.
const sendNotificationEmail = async (submission) => {
  if (!RESEND_API_KEY) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  const lines = [
    `Source : ${submission.source}`,
    submission.eventType ? `Type d'événement : ${submission.eventType}` : null,
    submission.concept ? `Thème : ${submission.concept}` : null,
    `Nom : ${submission.name}`,
    `Email : ${submission.email}`,
    "",
    submission.message,
  ].filter((line) => line !== null);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: RESEND_TO,
        subject: `Nouvelle demande AnimatiQ — ${submission.name}`,
        text: lines.join("\n"),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Resend error ${response.status}: ${body}`);
    }
  } catch (err) {
    console.error("Failed to send notification email:", err.message || err);
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { sendNotificationEmail };
