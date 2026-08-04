const fs = require("fs");
const path = require("path");

// Models a JSON affiliate feed: an array of raw listing objects.
function loadLocalJsonFeed(source) {
  const filePath = path.resolve(source.path);
  const raw = fs.readFileSync(filePath, "utf8");
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) {
    throw new Error(`Expected an array in JSON feed at ${filePath}`);
  }
  return records;
}

module.exports = { loadLocalJsonFeed };
