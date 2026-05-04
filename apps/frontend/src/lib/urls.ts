/**
 * Generates a market URL based on the environment.
 * If in production on rwshop.org, returns a subdomain URL.
 * Otherwise returns a path-based URL.
 */
export function getMarketUrl(slug: string): string {
  if (typeof window === 'undefined') return `/market/${slug}`;

  const hostname = window.location.hostname;
  
  // If we are on the main production domain or localhost
  if (hostname === 'rwshop.org' || hostname === 'www.rwshop.org') {
    return `https://${slug}.rwshop.org`;
  }
  
  if (hostname === 'localhost') {
    return `http://${slug}.localhost:3000`;
  }

  // Handle Render preview domains (e.g. rmf-frontend.onrender.com)
  if (hostname.endsWith('.onrender.com')) {
      const parts = hostname.split('.');
      if (parts.length === 3) {
          // rmf-frontend.onrender.com -> slug.rmf-frontend.onrender.com
          return `https://${slug}.${hostname}`;
      }
  }

  // Fallback to path-based
  return `/market/${slug}`;
}

/**
 * Generates a product URL.
 * If marketSlug is provided, it can generate a subdomain link.
 */
export function getProductUrl(productId: string, marketSlug?: string): string {
  if (typeof window === 'undefined') return `/product/${productId}`;

  const hostname = window.location.hostname;
  
  // If we have a market slug and we are on the main domain, go to subdomain
  if (marketSlug && (hostname === 'rwshop.org' || hostname === 'www.rwshop.org')) {
    return `https://${marketSlug}.rwshop.org/product/${productId}`;
  }

  // If we are already on a subdomain or localhost, just use relative path
  return `/product/${productId}`;
}
