// Calls the Postmark HTTP API directly (no SDK dependency required).
async function sendEmail({ to, subject, body }) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    throw new Error("POSTMARK_SERVER_TOKEN is not set");
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: process.env.EMAIL_FROM,
      To: to,
      Subject: subject,
      TextBody: body,
      MessageStream: "outbound",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Postmark send failed (${response.status}): ${text}`);
  }

  return { ok: true };
}

module.exports = { sendEmail };
