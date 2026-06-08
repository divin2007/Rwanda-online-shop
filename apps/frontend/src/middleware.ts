import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Platform-wide routes that should NEVER be rewritten on subdomains.
// These work identically on rwshop.org and mikeshop.rwshop.org.
const PLATFORM_ROUTES = [
  '/login',
  '/register',
  '/checkout',
  '/cart',
  '/orders',
  '/dashboard',
  '/seller',
  '/rider',
  '/admin',
  '/markets',
  '/market',
  '/product',
  '/products',
  '/settings',
  '/wallet',
  '/wishlist',
  '/privacy',
  '/terms',
  '/videos',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
];

const isIpv4Host = (hostname: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);

const apexHostFor = (hostname: string, hostWithPort: string) => {
  if (hostname.endsWith('.localhost')) return 'localhost:3000';
  if (hostname.endsWith('.onrender.com')) return hostWithPort.replace(/^[^.]+\./, '');
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts.slice(-2).join('.') : hostWithPort;
};

const protocolFor = (hostWithPort: string) => hostWithPort.includes('localhost') ? 'http' : 'https';

export function middleware(req: NextRequest) {
    const url = req.nextUrl.clone();
    const hostname = req.headers.get('host') || '';
    const cleanHostname = hostname.replace(/:\d+$/, '');
    const isIpHost = isIpv4Host(cleanHostname);
    const isLocalhost = cleanHostname === 'localhost' || cleanHostname.endsWith('.localhost') || isIpHost;
    
    // REDIRECT: If someone visits /market/[slug] directly on the main domain, redirect to subdomain
    if (url.pathname.startsWith('/market/')) {
      const parts = url.pathname.split('/');
      if (parts.length >= 3) {
        const slug = parts[2];
        const remainingPath = parts.slice(3).join('/');

        if (parts[3] === 'product' && parts[4]) {
          const apexHost = apexHostFor(cleanHostname, hostname);
          return NextResponse.redirect(new URL(`/product/${parts[4]}`, `${protocolFor(apexHost)}://${apexHost}`));
        }
        
        if ((cleanHostname === 'localhost' || isIpHost) && slug) {
          const remaining = remainingPath ? `/${remainingPath}` : '/';
          return NextResponse.redirect(new URL(remaining, `${protocolFor(hostname)}://${slug}.localhost${hostname.includes(':') ? ':' + hostname.split(':').pop() : ''}`));
        }

        if (!hostname.includes(`${slug}.`) && !isLocalhost) {
          const newHost = `${slug}.rwshop.org`;
          
          return NextResponse.redirect(new URL(`/${remainingPath}`, `${protocolFor(newHost)}://${newHost}`));
        }
      }
    }
    
  const hostParts = cleanHostname.split('.');
  
  // System reserved paths and root static files — skip middleware entirely
  if (url.pathname.startsWith('/_next') || 
      url.pathname.startsWith('/api') || 
      url.pathname.startsWith('/static') || 
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.txt') ||
      url.pathname.endsWith('.xml') ||
      url.pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Determine if this is a subdomain
  // Apex domains: rwshop.org, localhost, rmf-frontend.onrender.com
  // Subdomains: kimironko.rwshop.org, nyarugenge.localhost
  
  let subdomain = '';
  
  if (hostParts.length >= 3 && !isIpHost && !cleanHostname.endsWith('.onrender.com')) {
    // e.g. kimironko.rwshop.org
    if (hostParts[0] !== 'www') {
      subdomain = hostParts[0];
    }
  } else if (hostParts.length >= 2 && cleanHostname.endsWith('.localhost')) {
    // e.g. kimironko.localhost
    subdomain = hostParts[0];
  } else if (hostParts.length >= 4 && cleanHostname.endsWith('.onrender.com')) {
    // e.g. kimironko.rmf-frontend.onrender.com
    subdomain = hostParts[0];
  }

  if (subdomain && cleanHostname.endsWith('.localhost')) {
    const isPlatformRoute = PLATFORM_ROUTES.some(route => 
      url.pathname === route || url.pathname.startsWith(route + '/')
    );
    if (isPlatformRoute) {
      const isPrefetch = req.headers.get('purpose') === 'prefetch' || 
                         req.headers.has('x-middleware-prefetch') ||
                         req.headers.has('RSC') || 
                         url.searchParams.has('_rsc');
      if (isPrefetch) {
        return NextResponse.next();
      }
      const apexHost = apexHostFor(cleanHostname, hostname);
      return NextResponse.redirect(new URL(url.pathname + url.search, `${protocolFor(apexHost)}://${apexHost}`));
    }
    url.pathname = url.pathname === '/' ? `/market/${subdomain}` : `/market/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (subdomain) {
    // Check if this is a platform-wide route — if so, let it pass through unchanged
    const isPlatformRoute = PLATFORM_ROUTES.some(route => 
      url.pathname === route || url.pathname.startsWith(route + '/')
    );

    if (isPlatformRoute) {
      const isPrefetch = req.headers.get('purpose') === 'prefetch' || 
                         req.headers.has('x-middleware-prefetch') ||
                         req.headers.has('RSC') || 
                         url.searchParams.has('_rsc');
      if (isPrefetch) {
        return NextResponse.next();
      }
      // Platform routes work the same on all domains — no rewriting
      const apexHost = apexHostFor(cleanHostname, hostname);
      return NextResponse.redirect(new URL(url.pathname + url.search, `${protocolFor(apexHost)}://${apexHost}`));
    }

    // Only the root path "/" (and unknown paths) get rewritten to /market/[slug]
    // This shows the market storefront when visiting mikeshop.rwshop.org/
    url.pathname = `/market/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml).*)',
  ],
};
