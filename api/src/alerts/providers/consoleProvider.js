// Default provider: logs instead of sending. Safe for local dev with no email account configured.
async function sendEmail({ to, subject, body }) {
  console.log(`[email:console] to=${to} subject="${subject}"\n${body}\n`);
  return { ok: true };
}

module.exports = { sendEmail };
