import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  
  // Extract the hostname
  const hostname = req.headers.get('host') || '';
  const cleanHostname = hostname.replace(/:\d+$/, '');
  const hostParts = cleanHostname.split('.');
  
  // System reserved paths
  if (url.pathname.startsWith('/_next') || 
      url.pathname.startsWith('/api') || 
      url.pathname.startsWith('/static') || 
      url.pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // Determine if this is a subdomain
  // Apex domains: rwshop.org, localhost, rmf-frontend.onrender.com
  // Subdomains: kimironko.rwshop.org, nyarugenge.localhost
  
  let subdomain = '';
  
  if (hostParts.length >= 3 && !cleanHostname.endsWith('.onrender.com')) {
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

  if (subdomain) {
    // We rewrite the URL to internal path /market/[subdomain]
    url.pathname = `/market/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
