const CLUB_TYPES = new Set(["driver", "irons", "wedge", "putter", "hybrid", "fairway_wood"]);
const CONDITIONS = new Set(["new", "used"]);

// Validates and coerces a raw feed record. Returns { ok: true, record } or { ok: false, reason }.
function normalizeRecord(raw) {
  const hand = String(raw.hand ?? "").trim().toLowerCase();
  if (hand !== "left") {
    return { ok: false, reason: `not left-handed (hand=${raw.hand})` };
  }

  const brand = String(raw.brand ?? "").trim();
  const name = String(raw.name ?? raw.product_name ?? "").trim();
  if (!brand || !name) {
    return { ok: false, reason: "missing brand or name" };
  }

  const clubType = String(raw.club_type ?? raw.type ?? "").trim().toLowerCase();
  if (!CLUB_TYPES.has(clubType)) {
    return { ok: false, reason: `invalid club_type (${raw.club_type})` };
  }

  const condition = String(raw.condition ?? "new").trim().toLowerCase();
  if (!CONDITIONS.has(condition)) {
    return { ok: false, reason: `invalid condition (${raw.condition})` };
  }

  const priceCents = toCents(raw.price_cents, raw.price);
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, reason: `invalid price (${raw.price_cents ?? raw.price})` };
  }

  const originalPriceCents = toCents(raw.original_price_cents, raw.original_price ?? raw.msrp);
  if (originalPriceCents !== null && originalPriceCents <= 0) {
    return { ok: false, reason: `invalid original_price (${raw.original_price_cents ?? raw.original_price})` };
  }

  const productUrl = String(raw.product_url ?? raw.url ?? "").trim();
  if (!productUrl) {
    return { ok: false, reason: "missing product_url" };
  }

  return {
    ok: true,
    record: {
      brand,
      name,
      clubType,
      loft: emptyToNull(raw.loft),
      shaft: emptyToNull(raw.shaft),
      length: emptyToNull(raw.length),
      lieAngle: emptyToNull(raw.lie_angle),
      imageUrl: emptyToNull(raw.image_url),
      condition,
      priceCents,
      originalPriceCents,
      currency: String(raw.currency ?? "USD").trim().toUpperCase(),
      productUrl,
      inStock: toBoolean(raw.in_stock, true),
      externalListingId: emptyToNull(raw.external_listing_id ?? raw.sku),
    },
  };
}

// Explicit *_cents field wins (already integer cents). Otherwise treat as
// a dollar-denominated field and convert. Never guess from magnitude --
// a $1500 iron set would be misread as $15.00.
function toCents(centsValue, dollarsValue) {
  if (centsValue !== undefined && centsValue !== null && centsValue !== "") {
    const cents = Number(centsValue);
    return Number.isInteger(cents) ? cents : null;
  }
  if (dollarsValue === undefined || dollarsValue === null || dollarsValue === "") return null;
  const dollars = Number(dollarsValue);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

// Feed values may already be booleans (JSON) or strings (CSV: "true"/"false"/"1"/"0"/"").
function toBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no"].includes(normalized)) return false;
  if (["true", "1", "yes"].includes(normalized)) return true;
  return defaultValue;
}

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

module.exports = { normalizeRecord };
