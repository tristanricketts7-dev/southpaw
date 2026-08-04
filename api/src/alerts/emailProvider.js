const PROVIDERS = {
  console: () => require("./providers/consoleProvider"),
  postmark: () => require("./providers/postmarkProvider"),
  sendgrid: () => require("./providers/sendgridProvider"),
};

function getEmailProvider() {
  const name = process.env.EMAIL_PROVIDER || "console";
  const load = PROVIDERS[name];
  if (!load) {
    throw new Error(`Unknown EMAIL_PROVIDER "${name}"`);
  }
  return load();
}

module.exports = { getEmailProvider };
