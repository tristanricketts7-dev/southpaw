// Calls the SendGrid HTTP API directly (no SDK dependency required).
async function sendEmail({ to, subject, body }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.EMAIL_FROM },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SendGrid send failed (${response.status}): ${text}`);
  }

  return { ok: true };
}

module.exports = { sendEmail };
