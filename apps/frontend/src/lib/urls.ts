/**
 * Generates a market URL based on the environment.
 * If in production on rwshop.org, returns a subdomain URL.
 * Otherwise returns a path-based URL.
 */
export function getMarketUrl(slug: string): string {
  return `/market/${slug}`;
}

/**
 * Generates a product URL.
 * If marketSlug is provided, it can generate a subdomain link.
 */
export function getProductUrl(productId: string, marketSlug?: string): string {
  return marketSlug ? `/market/${marketSlug}/product/${productId}` : `/product/${productId}`;
}
