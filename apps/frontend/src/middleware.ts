import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  
  // Extract the hostname
  const hostname = req.headers.get('host') || '';
  
  // Handle localhost port strip
  const cleanHostname = hostname.replace(/:\d+$/, '');
  
  // Standard domain logic
  // If it's marketrwanda.com or www.marketrwanda.com
  const isApex = cleanHostname === 'marketrwanda.com' || cleanHostname === 'www.marketrwanda.com' || cleanHostname === 'localhost';

  // Subdomain matching (e.g. kimironko.marketrwanda.com)
  if (!isApex && cleanHostname.includes('.')) {
    const subdomain = cleanHostname.split('.')[0];
    
    // We rewrite the URL to internal path /market/[subdomain]
    // Only if it's not already pointing to a system path (_next, api, static)
    if (!url.pathname.startsWith('/_next') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/static')) {
      url.pathname = `/market/${subdomain}${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
