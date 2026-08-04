const SELLER_TYPES = new Set(["chain", "brand_direct", "marketplace", "independent"]);

async function upsertSeller(client, seller) {
  const sellerType = SELLER_TYPES.has(seller.sellerType) ? seller.sellerType : "independent";
  const { rows } = await client.query(
    `INSERT INTO sellers (name, seller_type, website_url, affiliate_network)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET
       website_url = EXCLUDED.website_url,
       affiliate_network = EXCLUDED.affiliate_network
     RETURNING id`,
    [seller.name, sellerType, seller.websiteUrl, seller.affiliateNetwork ?? null]
  );
  return rows[0].id;
}

async function upsertBrand(client, brandName) {
  const { rows } = await client.query(
    `INSERT INTO brands (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [brandName]
  );
  return rows[0].id;
}

async function upsertProduct(client, brandId, record) {
  const { rows } = await client.query(
    `INSERT INTO products (brand_id, name, club_type, loft, shaft, length, lie_angle, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (brand_id, name, club_type) DO UPDATE SET
       loft = COALESCE(EXCLUDED.loft, products.loft),
       shaft = COALESCE(EXCLUDED.shaft, products.shaft),
       length = COALESCE(EXCLUDED.length, products.length),
       lie_angle = COALESCE(EXCLUDED.lie_angle, products.lie_angle),
       image_url = COALESCE(EXCLUDED.image_url, products.image_url)
     RETURNING id`,
    [brandId, record.name, record.clubType, record.loft, record.shaft, record.length, record.lieAngle, record.imageUrl]
  );
  return rows[0].id;
}

// Returns existing listing id + its current price, matching by
// (seller_id, external_listing_id) when the feed gives us a stable SKU,
// otherwise by (product_id, seller_id, condition) as a practical fallback.
async function findExistingListing(client, productId, sellerId, record) {
  if (record.externalListingId) {
    const { rows } = await client.query(
      `SELECT id, price_cents FROM listings WHERE seller_id = $1 AND external_listing_id = $2`,
      [sellerId, record.externalListingId]
    );
    if (rows[0]) return rows[0];
  }

  const { rows } = await client.query(
    `SELECT id, price_cents FROM listings
     WHERE product_id = $1 AND seller_id = $2 AND condition = $3`,
    [productId, sellerId, record.condition]
  );
  return rows[0] ?? null;
}

async function upsertListing(client, productId, sellerId, record) {
  const existing = await findExistingListing(client, productId, sellerId, record);
  const priceChanged = !existing || existing.price_cents !== record.priceCents;

  let listingId;
  if (existing) {
    const { rows } = await client.query(
      `UPDATE listings SET
         condition = $1, price_cents = $2, original_price_cents = $3, currency = $4,
         product_url = $5, in_stock = $6, external_listing_id = $7, last_seen_at = now()
       WHERE id = $8
       RETURNING id`,
      [
        record.condition,
        record.priceCents,
        record.originalPriceCents,
        record.currency,
        record.productUrl,
        record.inStock,
        record.externalListingId,
        existing.id,
      ]
    );
    listingId = rows[0].id;
  } else {
    const { rows } = await client.query(
      `INSERT INTO listings
         (product_id, seller_id, condition, price_cents, original_price_cents, currency, product_url, in_stock, external_listing_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        productId,
        sellerId,
        record.condition,
        record.priceCents,
        record.originalPriceCents,
        record.currency,
        record.productUrl,
        record.inStock,
        record.externalListingId,
      ]
    );
    listingId = rows[0].id;
  }

  if (priceChanged) {
    await client.query(
      `INSERT INTO price_history (listing_id, price_cents) VALUES ($1, $2)`,
      [listingId, record.priceCents]
    );
  }

  return { listingId, priceChanged, previousPriceCents: existing ? existing.price_cents : null };
}

// Runs the full find-or-create chain for one normalized record within a transaction.
async function upsertRecord(client, sellerId, record) {
  const brandId = await upsertBrand(client, record.brand);
  const productId = await upsertProduct(client, brandId, record);
  return upsertListing(client, productId, sellerId, record);
}

module.exports = { upsertSeller, upsertRecord };
