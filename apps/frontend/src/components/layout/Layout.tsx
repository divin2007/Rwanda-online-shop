'use client';
import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/components/cart/CartContext';
import { userApi } from '@/lib/api';
import {
  getOperationalHomeHref,
  getOperationalNavItems,
  OperationalSidebar,
} from './OperationalSidebar';

interface LayoutProps {
  children: ReactNode;
}

type LanguageCode = 'en' | 'fr' | 'kin';

const languageLabels: Record<LanguageCode, string> = {
  en: 'English',
  fr: 'French',
  kin: 'Kinyarwanda',
};

const publicNavItems = [
  { label: 'Markets', href: '/markets', match: /^\/markets(?:\/|$)/ },
  { label: 'Products', href: '/products', match: /^\/products(?:\/|$)/ },
  { label: 'Riders', href: '/riders', match: /^\/riders(?:\/|$)/ },
  { label: 'Live', href: '/live', match: /^\/live(?:\/|$)/ },
];

const LayoutContent = ({ children }: LayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { cartCount } = useCart();
  const [globalSearch, setGlobalSearch] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  
  const [isSubdomain, setIsSubdomain] = useState(false);
  const [apexUrl, setApexUrl] = useState('');
  // B2B nav visibility (Feature 7): show "B2B" only to users with a verified B2B account.
  const [hasB2bAccount, setHasB2bAccount] = useState(false);

  useEffect(() => {
    if (!user) { setHasB2bAccount(false); return; }
    let active = true;
    userApi.get('/b2b/accounts/me')
      .then((res) => { if (active) setHasB2bAccount(Boolean(res.data?.data?.isVerified)); })
      .catch(() => { if (active) setHasB2bAccount(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');
      
      let subdomain = '';
      if (isLocalhost) {
        const parts = hostname.split('.');
        if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
          subdomain = parts[0];
        }
      } else {
        const parts = hostname.split('.');
        if (parts.length >= 3 && parts[0] !== 'www') {
          subdomain = parts[0];
        }
      }

      if (subdomain) {
        setIsSubdomain(true);
        if (isLocalhost) {
          setApexUrl(`${window.location.protocol}//localhost${port}`);
        } else {
          setApexUrl(`${window.location.protocol}//rwshop.org${port}`);
        }
      } else {
        setIsSubdomain(false);
        setApexUrl('');
      }
    }
  }, []);

  const getPlatformHref = (path: string) => {
    if (isSubdomain && apexUrl) {
      return `${apexUrl}${path}`;
    }
    return path;
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      router.push(`/markets?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  const operationalPathPrefixes = ['/dashboard', '/seller', '/rider', '/admin', '/settings', '/orders', '/wallet', '/wishlist', '/messages', '/disputes'];
  const publicOnboardingPaths = ['/seller/onboarding', '/rider/register', '/rider/setup'];
  const isDashboard = operationalPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
                      !publicOnboardingPaths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const navItems = getOperationalNavItems(user?.role);
  
  const isNavActive = (href: string) => {
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      return pathname === path && searchParams.toString().includes(query);
    }
    if (pathname === href && searchParams.toString()) {
      const hasQuerySpecificSibling = navItems.some((item) => item.href.startsWith(`${href}?`) && isNavActive(item.href));
      if (hasQuerySpecificSibling) return false;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const accountHref = getOperationalHomeHref(user?.role);

  const activeDashboardItem = navItems.find((item) => isNavActive(item.href));
  const dashboardTitle = activeDashboardItem?.label || 'Dashboard';
  const dashboardStatus = user?.role === 'ADMIN'
    ? 'GLOBAL OPS'
    : user?.role === 'SELLER'
      ? 'SELLER STATION'
      : user?.role === 'RIDER'
        ? 'RIDER CONSOLE'
        : 'OPERATIONAL HUB';

  const routeToLocation = (href: string) => {
    router.push(href);
    setLocationOpen(false);
  };

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDetectedLocation('Location unavailable. Showing Kigali markets.');
      routeToLocation('/markets?location=Kigali&search=Kigali');
      return;
    }

    setDetectedLocation('Finding nearby markets...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          location: 'Near me',
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        });
        setDetectedLocation('Using current location');
        routeToLocation(`/markets?${params.toString()}`);
      },
      () => {
        setDetectedLocation('Location unavailable. Showing Kigali markets.');
        routeToLocation('/markets?location=Kigali&search=Kigali');
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md antialiased flex flex-col selection:bg-primary-container selection:text-on-primary">
      
      {/* ---------------- Operational Top Navigation Bar ---------------- */}
      {isDashboard ? (
        <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-gutter">
          <div className="flex min-w-0 items-center gap-sm">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded p-xs text-primary transition hover:bg-surface-container md:hidden"
              aria-label="Toggle operational navigation"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <Link href={getPlatformHref(accountHref)} className="flex items-center text-primary transition hover:text-primary-container">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_back</span>
            </Link>
            <h2 className="truncate font-headline-md text-headline-md font-bold text-primary">{dashboardTitle}</h2>
            <span className="ml-sm hidden items-center gap-xs rounded border border-outline-variant bg-surface-container-low px-sm py-xs font-label-caps text-label-caps text-on-surface sm:flex">
              <span className="h-2 w-2 rounded-full bg-primary-container" />
              {dashboardStatus}
            </span>
          </div>

          <div className="hidden items-center gap-md md:flex">
            <button
              onClick={() => { setLocationOpen(!locationOpen); setLangOpen(false); setAccountOpen(false); }}
              className="p-xs text-primary transition hover:text-primary-container"
              title="Location"
            >
              <span className="material-symbols-outlined">location_on</span>
            </button>
            <button
              onClick={() => { setLangOpen(!langOpen); setLocationOpen(false); setAccountOpen(false); }}
              className="p-xs text-primary transition hover:text-primary-container"
              title="Language"
            >
              <span className="material-symbols-outlined">language</span>
            </button>
            {user ? (
              <>
                <Link className="ml-sm font-label-caps text-label-caps font-bold text-primary transition hover:text-primary-container" href={getPlatformHref(accountHref)}>Switch Role</Link>
                <Link className="rounded bg-primary-container px-sm py-xs font-label-caps text-label-caps text-on-primary transition hover:opacity-90" href={getPlatformHref('/cart')}>
                  Basket ({cartCount})
                </Link>
                <div className="relative">
                  <button
                    onClick={() => { setAccountOpen(!accountOpen); setLangOpen(false); setLocationOpen(false); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-inverse-surface text-[10px] font-bold text-inverse-on-surface"
                    aria-label="Open account menu"
                  >
                    {(user.fullName || 'RMF').slice(0, 1).toUpperCase()}
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-10 z-50 w-48 rounded border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
                      <div className="truncate border-b border-outline-variant bg-surface-container-low p-md font-label-caps text-label-caps text-on-surface-variant">
                        {user.fullName || 'Active Session'}
                      </div>
                      <Link href={getPlatformHref('/')} className="block px-md py-sm text-body-md text-on-surface transition-colors hover:bg-surface-container-low">Marketplace</Link>
                      <Link href={getPlatformHref('/orders')} className="block px-md py-sm text-body-md text-on-surface transition-colors hover:bg-surface-container-low">Orders</Link>
                      {hasB2bAccount && (
                        <Link href={getPlatformHref('/b2b/dashboard')} className="block px-md py-sm text-body-md text-on-surface transition-colors hover:bg-surface-container-low">B2B</Link>
                      )}
                      <button onClick={logout} className="block w-full px-md py-sm text-left text-body-md font-bold text-error transition-colors hover:bg-error-container/20">Sign Out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link className="ml-sm font-label-caps text-label-caps font-bold text-primary transition hover:text-primary-container" href={getPlatformHref('/login')}>Sign In</Link>
                <Link className="rounded bg-primary-container px-sm py-xs font-label-caps text-label-caps text-on-primary transition hover:opacity-90" href={getPlatformHref('/register')}>Register</Link>
                <Link className="rounded border border-outline-variant bg-surface-container-lowest px-sm py-xs font-label-caps text-label-caps text-on-surface transition hover:border-primary hover:text-primary" href={getPlatformHref('/cart')}>
                  Basket ({cartCount})
                </Link>
              </>
            )}
          </div>

          {locationOpen && (
            <div className="absolute right-24 top-14 z-50 w-72 overflow-hidden rounded border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)]">
              <div className="border-b border-outline-variant bg-surface-container-low p-md">
                <p className="font-label-caps text-label-caps text-primary">Market Hub Locations</p>
              </div>
              <button
                onClick={useCurrentLocation}
                className="flex w-full items-center gap-sm border-b border-outline-variant px-md py-3 text-left text-body-md font-semibold transition-colors hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[20px] text-primary-container">my_location</span>
                <span>Use GPS Location</span>
              </button>
              <div className="space-y-xs p-xs">
                {['Kigali', 'Kimironko', 'Nyabugogo', 'Kigali City Market'].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => routeToLocation(`/markets?location=${loc}&search=${loc}`)}
                    className="w-full rounded px-md py-2 text-left text-body-md font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {langOpen && (
            <div className="absolute right-16 top-14 z-50 w-48 space-y-1 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5 shadow-[0_12px_40px_rgba(27,28,28,0.08)]">
              <p className="mb-1 border-b border-outline-variant/40 px-2 pb-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-primary">Available Languages</p>
              {[
                { code: 'en', label: 'English' },
                { code: 'fr', label: 'French' },
                { code: 'kin', label: 'Kinyarwanda' },
              ].map((langOption) => (
                <button
                  key={langOption.code}
                  onClick={() => {
                    setLanguage(langOption.code as any);
                    setLangOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    language === langOption.code
                      ? 'bg-primary-fixed-dim/20 font-bold text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span>{langOption.label}</span>
                  {language === langOption.code && (
                    <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </header>
      ) : (
        <header className="bg-surface border-b border-outline-variant shadow-sm top-0 sticky z-50 transition-all duration-300">
          <div className="flex justify-between items-center w-full max-w-container-max mx-auto px-gutter h-16">
            
            {/* Left Section: Logo & Navigation */}
            <div className="flex items-center gap-xl shrink-0">
              <Link href={getPlatformHref("/")} className="font-headline-lg text-headline-lg leading-none font-bold text-primary tracking-normal">RMF Facilitator</Link>
              <nav className="hidden lg:flex items-center gap-lg">
                {publicNavItems.map((item) => {
                  const active = item.match.test(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={getPlatformHref(item.href)}
                      className={`border-b-2 py-1 text-body-md font-semibold transition-all hover:text-primary-container ${
                        active ? 'border-primary text-primary' : 'border-transparent text-secondary'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {hasB2bAccount && (
                  <Link
                    href={getPlatformHref('/b2b/dashboard')}
                    className={`border-b-2 py-1 text-body-md font-semibold transition-all hover:text-primary-container ${
                      pathname.startsWith('/b2b') ? 'border-primary text-primary' : 'border-transparent text-secondary'
                    }`}
                  >
                    B2B
                  </Link>
                )}
              </nav>
            </div>
            
            {/* Middle Section: Centered, Wide, Pure White Search Input */}
            <form onSubmit={handleSearch} className="relative hidden md:block w-64 shrink-0 z-10">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input 
                value={globalSearch} 
                onChange={e => setGlobalSearch(e.target.value)} 
                className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all w-full text-on-surface hover:border-outline" 
                placeholder="Search markets..." 
                type="text"
              />
            </form>
            
            {/* Right Section: Tools, Language dropdown, User account, Basket */}
            <div className="flex items-center gap-sm shrink-0">
              {/* Location Dialog Trigger */}
              <div className="relative hidden sm:block">
                <button 
                  onClick={() => { setLocationOpen(!locationOpen); setLangOpen(false); setAccountOpen(false); }} 
                  className="p-2 text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs"
                  title="Select Market Location"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                </button>
                {locationOpen && (
                  <div className="absolute right-0 top-11 w-72 rounded border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)] z-50 overflow-hidden">
                    <div className="p-md bg-surface-container-low border-b border-outline-variant">
                      <p className="font-label-caps text-label-caps text-primary">Market Hub Locations</p>
                    </div>
                    <button 
                      onClick={useCurrentLocation} 
                      className="w-full text-left px-md py-3 hover:bg-surface-container-low border-b border-outline-variant flex items-center gap-sm transition-colors text-body-md font-semibold"
                    >
                      <span className="material-symbols-outlined text-primary-container text-[20px]">my_location</span>
                      <span>Use GPS Location</span>
                    </button>
                    <div className="p-xs space-y-xs">
                      {['Kigali', 'Kimironko', 'Nyabugogo', 'Kigali City Market'].map((loc) => (
                        <button 
                          key={loc}
                          onClick={() => routeToLocation(`/markets?location=${loc}&search=${loc}`)}
                          className="w-full text-left px-md py-2 rounded hover:bg-surface-container-low text-body-md text-on-surface transition-colors font-semibold"
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Language Picker Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => { setLangOpen(!langOpen); setLocationOpen(false); setAccountOpen(false); }} 
                  className="p-2 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center"
                  title="Select Language"
                >
                  <span className="material-symbols-outlined">language</span>
                </button>
                {langOpen && (
                  <div className="absolute right-0 top-11 w-48 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_12px_40px_rgba(27,28,28,0.08)] z-50 overflow-hidden p-2.5 space-y-1">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-primary px-2 pb-1.5 border-b border-outline-variant/40 mb-1">Available Languages</p>
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'fr', label: 'French' },
                      { code: 'kin', label: 'Kinyarwanda' },
                    ].map((langOption) => (
                      <button 
                        key={langOption.code}
                        onClick={() => {
                          setLanguage(langOption.code as any);
                          setLangOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                          language === langOption.code 
                            ? 'bg-primary-fixed-dim/20 text-primary font-bold' 
                            : 'hover:bg-surface-container-low text-on-surface-variant'
                        }`}
                      >
                        <span>{langOption.label}</span>
                        {language === langOption.code && (
                          <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-md ml-sm border-l border-outline-variant pl-md shrink-0">
              {user ? (
                <div className="relative flex items-center gap-md">
                  <Link href={getPlatformHref(accountHref)} className="text-label-caps font-label-caps font-bold text-on-surface hover:text-primary transition-colors">
                    Switch Role
                  </Link>
                  <button
                    onClick={() => { setAccountOpen(!accountOpen); setLangOpen(false); setLocationOpen(false); }}
                    aria-label="Open account menu"
                  >
                    <img 
                      alt="User profile avatar" 
                      className="w-10 h-10 rounded-full border border-outline-variant object-cover cursor-pointer" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzYVrYyjn-ODLM1nWlNeywUBQjwuKGqDIGA-HhY-e2xAyDyoe6gwfsB3oSexA_8hjOjHRxCnYJYnACvLEtjV4Xl1CXoqzRs-BEsvbuXC-Z-IUVGYydWlthghCmxkGWllkP0E2i7k7FT6weKjsYPLb2_TujUrusqc1Hr1M1K0zlp40cepmt0rlb8TdazpeSM3wB8s2GITuLayHHAsUuJClT5ZhjgjNcZfi3B01QeQiZRjzllA69Oeh0oasxAme8zh5pvrIK70wmWk-K"
                    />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-12 w-48 rounded border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(27,28,28,0.03)] z-50">
                      <div className="p-md border-b border-outline-variant bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant truncate">
                        {user.fullName || 'Logged In'}
                      </div>
                      <Link href={getPlatformHref("/orders")} className="block px-md py-sm text-body-md text-on-surface hover:bg-surface-container-low transition-colors">My Orders</Link>
                      <Link href={getPlatformHref("/wallet")} className="block px-md py-sm text-body-md text-on-surface hover:bg-surface-container-low transition-colors">Wallet Ledger</Link>
                      <button onClick={logout} className="w-full text-left block px-md py-sm text-body-md text-error hover:bg-error-container/20 transition-colors font-bold">Sign Out</button>
                    </div>
                  )}
                </div>
              ) : (
                  <>
                    <Link href={getPlatformHref("/login")} className="hidden xl:block text-label-caps font-label-caps font-bold text-on-surface hover:text-primary transition-colors">Sign In</Link>
                    <Link href={getPlatformHref("/register")} className="hidden xl:block text-label-caps font-label-caps font-bold text-on-surface hover:text-primary transition-colors">Register</Link>
                  </>
                )}
                
                <Link href={getPlatformHref("/cart")} className="flex items-center gap-xs bg-primary-container text-on-primary px-4 py-2 rounded-full hover:bg-primary transition-colors" style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <span className="material-symbols-outlined text-[20px]">shopping_basket</span>
                  <span className="font-label-caps text-label-caps">Basket ({cartCount})</span>
                </Link>
              </div>
            </div>
          <nav className="border-t border-outline-variant bg-surface-container-lowest lg:hidden">
            <div className="mx-auto flex w-full max-w-container-max gap-md overflow-x-auto px-gutter py-2">
              {publicNavItems.map((item) => {
                const active = item.match.test(pathname);
                return (
                  <Link
                    key={`mobile-${item.href}`}
                    href={getPlatformHref(item.href)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 font-label-caps text-label-caps transition-colors ${
                      active
                        ? 'border-primary-container bg-primary-container text-on-primary'
                        : 'border-outline-variant bg-surface text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {hasB2bAccount && (
                <Link
                  href={getPlatformHref('/b2b/dashboard')}
                  className={`shrink-0 rounded-full border px-3 py-1.5 font-label-caps text-label-caps transition-colors ${
                    pathname.startsWith('/b2b')
                      ? 'border-primary-container bg-primary-container text-on-primary'
                      : 'border-outline-variant bg-surface text-secondary hover:border-primary hover:text-primary'
                  }`}
                >
                  B2B
                </Link>
              )}
            </div>
          </nav>
          </header>
        )}

      {/* ---------------- Main Content Layout Layer ---------------- */}
      <div className="flex-grow flex relative">
        
        {/* Left Side Navigation (same component as order tracking) */}
        {isDashboard && (
          <OperationalSidebar
            role={user?.role}
            mobileOpen={mobileMenuOpen}
            onLogout={user ? logout : undefined}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Scrollable Main Content Frame */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
          <div className={`flex-1 overflow-y-auto w-full`}>
            {children}
          </div>
        </main>

      </div>
      
      {/* ---------------- Clean Cinematic Footer (Stitch Blueprint) ---------------- */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant mt-auto shrink-0">
        <div className="w-full py-lg px-gutter md:px-xl flex flex-col md:flex-row justify-between items-center gap-md">
          <div className="font-label-caps text-label-caps font-bold text-primary">RMF Facilitator</div>
          <nav className="flex flex-wrap gap-md justify-center">
            <Link className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors" href="/terms">Legal</Link>
            <Link className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors" href="/privacy">Privacy Policy</Link>
            <Link className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors" href="/contact">Contact Us</Link>
            <Link className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors" href="/terms">Terms of Service</Link>
          </nav>
          <div className="font-body-md text-body-md text-on-surface-variant text-sm">
            © 2026 Rwanda Market Facilitator. Secured by MTN MoMo.
          </div>
        </div>
      </footer>

    </div>
  );
};

export const Layout = (props: LayoutProps) => {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full"></div>
      </div>
    }>
      <LayoutContent {...props} />
    </React.Suspense>
  );
};
