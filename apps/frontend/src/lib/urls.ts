const cleanSlug = (slug: string) => String(slug || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/^-+|-+$/g, '');

/**
 * Generates the canonical market storefront URL.
 * Markets live on subdomains, including local dev: murekatete.localhost:3000.
 */
export function getMarketUrl(slug: string): string {
  const marketSlug = cleanSlug(slug);
  if (!marketSlug) return '/markets';

  if (typeof window === 'undefined') {
    return `/market/${marketSlug}`;
  }

  const { protocol, hostname, port, host } = window.location;
  const portSuffix = port ? `:${port}` : '';

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return `${protocol}//${marketSlug}.localhost${portSuffix}/`;
  }

  if (hostname === 'rwshop.org' || hostname === 'www.rwshop.org' || hostname.endsWith('.rwshop.org')) {
    return `https://${marketSlug}.rwshop.org/`;
  }

  const apexHost = host.replace(/^[^.]+\./, '');
  return `${protocol}//${marketSlug}.${apexHost}/`;
}

/**
 * Generates the canonical product URL.
 * Product details are platform-wide, so keep them off market subdomains/slug paths.
 */
export function getProductUrl(productId: string): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const portSuffix = port ? `:${port}` : '';

    if (hostname.endsWith('.localhost')) {
      return `${protocol}//localhost${portSuffix}/product/${productId}`;
    }

    if (hostname.endsWith('.rwshop.org') && hostname !== 'rwshop.org' && hostname !== 'www.rwshop.org') {
      return `https://rwshop.org/product/${productId}`;
    }
  }

  return `/product/${productId}`;
}
