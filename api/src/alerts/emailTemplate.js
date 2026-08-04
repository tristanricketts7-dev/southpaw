function formatPrice(cents, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// Builds the price-drop email for one watchlist item hitting its target/drop condition.
function buildPriceDropEmail({ productName, brandName, sellerName, priceCents, previousPriceCents, currency, productUrl, appBaseUrl }) {
  const discountPct = previousPriceCents
    ? Math.round((100 * (previousPriceCents - priceCents)) / previousPriceCents)
    : 0;

  const subject = `Price drop: ${brandName} ${productName} is now ${formatPrice(priceCents, currency)}`;

  const priceLine = previousPriceCents
    ? `${formatPrice(previousPriceCents, currency)} -> ${formatPrice(priceCents, currency)} (${discountPct}% off)`
    : formatPrice(priceCents, currency);

  const body = [
    `${brandName} ${productName} at ${sellerName} just dropped in price.`,
    "",
    priceLine,
    "",
    `View listing: ${productUrl}`,
    "",
    `Manage your watchlist: ${appBaseUrl}`,
  ].join("\n");

  return { subject, body };
}

module.exports = { buildPriceDropEmail };
