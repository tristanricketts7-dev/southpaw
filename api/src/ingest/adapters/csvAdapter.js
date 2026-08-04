const fs = require("fs");
const path = require("path");

// Models an independent shop's spreadsheet export: CSV with a header row.
// Minimal RFC4180-ish parser (handles quoted fields, escaped quotes, commas
// inside quotes) -- no external dependency needed for this scale of feed.
function loadCsvFeed(source) {
  const filePath = path.resolve(source.path);
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const record = {};
      header.forEach((key, i) => {
        record[key.trim()] = row[i] !== undefined ? row[i] : "";
      });
      return record;
    });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

module.exports = { loadCsvFeed };
