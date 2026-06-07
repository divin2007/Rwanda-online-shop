'use client';
import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, LocateFixed, LogOut, MapPin, Menu, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, UserCircle, UserPlus, Video, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/components/cart/CartContext';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
}

type LanguageCode = 'en' | 'fr' | 'kin';

const languageLabels: Record<LanguageCode, string> = {
  en: 'English',
  fr: 'French',
  kin: 'Kinyarwanda',
};

const LayoutContent = ({ children }: LayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { cartCount } = useCart();
  const [globalSearch, setGlobalSearch] = useState('');
  const [apexHome, setApexHome] = useState('/');
  const [isSubdomain, setIsSubdomain] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState('');
  const queryString = searchParams.toString();
  const platformHref = (href: string) => isSubdomain && href.startsWith('/') ? `${apexHome}${href}` : href;

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const hostname = window.location.hostname;
      const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
      // If we are on a subdomain (e.g., kigali.localhost:3000), 
      // the root is the second half of the host.
      if (host.includes('.localhost:3000')) {
        setApexHome('http://localhost:3000');
        setIsSubdomain(true);
      } else if (!isIpv4 && hostname.split('.').length >= 3 && !host.includes('onrender.com')) {
        // Production: market.rwshop.org -> rwshop.org
        const base = hostname.split('.').slice(-2).join('.');
        setApexHome(`https://${base}`);
        setIsSubdomain(true);
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      setMobileMenuOpen(false);
      const href = `/markets?search=${encodeURIComponent(globalSearch.trim())}`;
      if (isSubdomain && typeof window !== 'undefined') {
        window.location.assign(platformHref(href));
        return;
      }
      router.push(href);
    }
  };

  // Navigation items per role — using natural e-commerce language
  const buyerNav = [
    { label: t('nav_home') || 'Home', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, href: '/', hidden: !isSubdomain },
    { label: t('nav_hub') || 'Markets', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, href: '/markets' },
    { label: 'Products', icon: <ShoppingBag size={18} />, href: '/products' },
    { label: 'Videos', icon: <Video size={18} />, href: '/videos' },
    { label: 'For You', icon: <Sparkles size={18} />, href: '/preferences', auth: true },
    { label: t('nav_dashboard') || 'My Account', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, href: '/dashboard', auth: true },
    { label: t('nav_mandates') || 'My Orders', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, href: '/orders', auth: true },
    { label: t('nav_wallet') || 'Wallet', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, href: '/wallet', auth: true },
    { label: t('nav_wishlist') || 'Wishlist', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, href: '/wishlist', auth: true },
    { label: 'Settings', icon: <UserCircle size={18} />, href: '/settings', auth: true },
  ];

  const sellerNav = [
    { label: t('dashboard_activity') || 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, href: '/seller/dashboard' },
    { label: t('nav_artifacts') || 'Products', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>, href: '/seller/products' },
    { label: t('hot_deals') || 'Promotions', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, href: '/seller/promotions' },
    { label: 'Video Ads', icon: <Video size={18} />, href: '/seller/videos' },
    { label: t('dashboard_ref_earnings') || 'Earnings', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, href: '/seller/earnings' },
    { label: 'Settings', icon: <UserCircle size={18} />, href: '/settings' },
  ];
  
  const riderNav = [
    { label: t('dashboard_activity') || 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, href: '/rider/dashboard' },
    { label: t('nav_mandates') || 'Deliveries', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, href: '/rider/deliveries' },
    { label: 'Settings', icon: <UserCircle size={18} />, href: '/settings' },
  ];

  const adminNav = [
    { label: 'Platform Analytics', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, href: '/admin?tab=analytics' },
    { label: 'Accounting', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, href: '/admin?tab=accounting' },
    { label: 'Live Operations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, href: '/admin?tab=live-map' },
    { label: 'Operations Center', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/><path d="M14 9h5v5"/></svg>, href: '/admin?tab=operations' },
    { label: 'Approvals', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>, href: '/admin?tab=approvals' },
    { label: 'Markets Directory', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, href: '/admin?tab=markets' },
    { label: 'Product Approvals', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, href: '/admin?tab=products' },
    { label: 'Taxonomy', icon: <SlidersHorizontal size={18} />, href: '/admin?tab=taxonomy' },
    { label: 'Disputes & Refunds', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, href: '/admin?tab=disputes' },
    { label: 'Fraud Alerts', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>, href: '/admin?tab=fraud' },
    { label: 'Payout Approvals', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>, href: '/admin?tab=payouts' },
    { label: 'User Management', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, href: '/admin/users' },
    { label: 'Video Moderation', icon: <Video size={18} />, href: '/admin/videos' },
    { label: 'Contracts', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, href: '/admin/contracts' },
    { label: 'Settings', icon: <UserCircle size={18} />, href: '/settings' },
  ];

  type NavItem = { label: string; icon: React.ReactElement; href: string; auth?: boolean; absolute?: boolean; hidden?: boolean };

  const navItems: NavItem[] = user?.role === 'ADMIN' ? adminNav : (user?.role === 'SELLER' ? sellerNav : (user?.role === 'RIDER' ? riderNav : buyerNav));
  const visibleNavItems = navItems.filter(item => (!item.auth || user) && !item.hidden);
  const isWorkstation = user?.role === 'SELLER' || user?.role === 'RIDER' || user?.role === 'ADMIN';
  const isDashboard = pathname.startsWith('/dashboard') || 
                      pathname.startsWith('/seller') || 
                      pathname.startsWith('/rider') || 
                      pathname.startsWith('/admin') ||
                      pathname.startsWith('/settings') ||
                      ['/orders', '/wallet', '/wishlist'].some(p => pathname === p || pathname.startsWith(p + '/'));
  const accountHref = user?.role === 'SELLER'
    ? '/seller/dashboard'
    : user?.role === 'RIDER'
      ? '/rider/dashboard'
      : user?.role === 'ADMIN'
        ? '/admin'
        : '/dashboard';
  const compactName = user?.fullName
    ? user.fullName.split(' ').filter(Boolean).slice(0, 2).map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(' ')
    : 'Sign in';
  const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
  const locationOptions = [
    { label: 'Kigali', detail: 'All Kigali markets', href: '/markets?location=Kigali&search=Kigali' },
    { label: 'Kimironko', detail: 'Fresh food and household sellers', href: '/markets?location=Kimironko&search=Kimironko' },
    { label: 'Nyabugogo', detail: 'Transit and wholesale hubs', href: '/markets?location=Nyabugogo&search=Nyabugogo' },
    { label: 'Kigali City Market', detail: 'City-center shopping', href: '/markets?location=Kigali%20City%20Market&search=Kigali%20City%20Market' },
    { label: 'Made in Rwanda', detail: 'Origin-tagged local goods', href: '/markets?search=Made%20in%20Rwanda' },
  ];
  const accountLinks = user?.role === 'ADMIN'
    ? [{ label: 'Admin portal', href: '/admin?tab=analytics' }, { label: 'Live operations', href: '/admin?tab=live-map' }, { label: 'Operations center', href: '/admin?tab=operations' }]
    : user?.role === 'SELLER'
      ? [{ label: 'Seller dashboard', href: '/seller/dashboard' }, { label: 'Products', href: '/seller/products' }, { label: 'Video ads', href: '/seller/videos' }]
      : user?.role === 'RIDER'
        ? [{ label: 'Rider dashboard', href: '/rider/dashboard' }, { label: 'Deliveries', href: '/rider/deliveries' }]
        : [{ label: 'My account', href: '/dashboard' }, { label: 'Recommendations', href: '/preferences' }, { label: 'Orders', href: '/orders' }];
  accountLinks.push({ label: 'Settings', href: '/settings' });

  React.useEffect(() => {
    setMobileMenuOpen(false);
    setLocationOpen(false);
    setAccountOpen(false);
  }, [pathname, queryString]);

  const isNavActive = (href: string) => {
    if (href === '/admin?tab=analytics' && pathname === '/admin' && !searchParams.get('tab')) return true;
    if (href.includes('?')) return currentHref === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const routeToLocation = (href: string) => {
    if (isSubdomain && typeof window !== 'undefined') {
      window.location.assign(platformHref(href));
      return;
    }
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
        setDetectedLocation('Using your current location');
        routeToLocation(`/markets?${params.toString()}`);
      },
      () => {
        // Fallback to coarse if high accuracy fails
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const params = new URLSearchParams({
              location: 'Near me',
              lat: String(pos.coords.latitude),
              lng: String(pos.coords.longitude),
            });
            setDetectedLocation('Using your current location');
            routeToLocation(`/markets?${params.toString()}`);
          },
          () => {
            setDetectedLocation('Location unavailable. Showing Kigali markets.');
            routeToLocation('/markets?location=Kigali&search=Kigali');
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-[#fdfaf7] font-sans selection:bg-[#ff6b00] selection:text-white flex flex-col">
      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-[#ebdcd0] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-3 px-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#574e47] transition hover:bg-[#ffedd5]/30 hover:text-[#ff6b00] md:hidden"
              aria-label="Open market categories"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            <a href={apexHome} className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-normal text-[#a04100]">RMF</span>
            </a>
          </div>

          <form onSubmit={handleSearch} className="relative hidden w-[min(420px,42vw)] md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a4136]" size={19} />
            <input
              type="text"
              placeholder={isDashboard ? 'Search orders or products...' : (t('home_search_placeholder') || 'Search markets or products...')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="h-11 w-full rounded border border-[#e2bfb0] bg-[#fbf9f8] pl-12 pr-4 text-sm font-medium text-[#1b1c1c] outline-none transition placeholder:text-[#8e7164] focus:border-[#ff6b00] focus:bg-white focus:ring-2 focus:ring-[#ffedd5]"
            />
          </form>

          {!isDashboard && (
            <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
              {[
                { href: '/', label: 'Home' },
                { href: '/markets', label: 'Explore' },
                { href: '/orders', label: 'Orders' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={platformHref(item.href)}
                  className={`border-b-2 px-1 py-5 text-sm font-medium transition-colors ${
                    isNavActive(item.href) ? 'border-[#a04100] text-[#a04100]' : 'border-transparent text-[#574e47] hover:text-[#a04100]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {!isDashboard && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setLocationOpen(open => !open)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#ebdcd0] bg-white px-3 text-xs font-black text-[#405046] transition hover:border-[#ff6b00] hover:text-[#ff6b00]"
                  aria-expanded={locationOpen}
                >
                  <MapPin size={15} />
                  {searchParams.get('location') || 'Kigali'}
                  <ChevronDown size={14} />
                </button>
                {locationOpen && (
                  <div className="absolute right-0 top-11 w-[calc(100vw-1.5rem)] max-w-80 overflow-hidden rounded-lg border border-[#ebdcd0] bg-white shadow-xl">
                    <div className="border-b border-[#f2e8e0] bg-[#fdfaf7] p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ff6b00]">Choose market area</p>
                      <p className="mt-1 text-xs font-semibold text-[#574e47]">Markets are filtered by service area and coordinates when available.</p>
                    </div>
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      className="flex w-full items-center gap-3 border-b border-[#f2e8e0] px-3 py-3 text-left transition hover:bg-[#fdfaf7]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff6b00] text-white">
                        <LocateFixed size={17} />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-[#1b1c1c]">Use current location</span>
                        <span className="block text-xs font-semibold text-[#5f7569]">{detectedLocation || 'Find nearby markets from the map layer'}</span>
                      </span>
                    </button>
                    <div className="p-2">
                      {locationOptions.map(option => (
                        <button
                          key={option.href}
                          type="button"
                          onClick={() => routeToLocation(option.href)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition hover:bg-[#f7faf8]"
                        >
                          <span>
                            <span className="block text-sm font-black text-[#1b1c1c]">{option.label}</span>
                            <span className="block text-xs font-semibold text-[#5f7569]">{option.detail}</span>
                          </span>
                          <ChevronDown className="-rotate-90 text-[#8b938d]" size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="hidden h-9 items-center gap-1 rounded-md border border-[#e0e0e0] bg-[#fcf9f8] px-1 lg:flex" aria-label={`Current language: ${languageLabels[language]}`}>
              <span className="rounded bg-white px-2 py-1 text-[10px] font-black uppercase text-[#ff6b00] shadow-sm">
                {language.toUpperCase()}
              </span>
              {(['en', 'fr', 'kin'] as LanguageCode[]).map((lang, index) => (
                <React.Fragment key={lang}>
                  <button
                    onClick={() => setLanguage(lang)}
                    title={languageLabels[lang]}
                    className={`rounded px-1.5 py-1 text-xs font-black uppercase transition ${
                      language === lang ? 'bg-[#ffedd5] text-[#ff6b00]' : 'text-[#405046] hover:text-[#ff6b00]'
                    }`}
                  >
                    {lang}
                  </button>
                  {index < 2 && <span className="text-xs font-black text-[#d2bca8]">/</span>}
                </React.Fragment>
              ))}
            </div>

            <NotificationBell compact />

            {!isWorkstation && (
              <Link href={platformHref('/cart')} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#ebdcd0] bg-white text-[#1b1c1c] transition hover:border-[#ff6b00] hover:text-[#ff6b00]" aria-label={t('nav_cart') || 'Cart'}>
                <ShoppingCart size={18} />
                <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#ffedd5] px-1.5 text-center text-[11px] font-black leading-5 text-[#ff6b00] shadow-sm">
                  {cartCount}
                </span>
              </Link>
            )}

            {user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen(open => !open)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-black text-[#405046] transition hover:bg-[#ffedd5]/30 hover:text-[#ff6b00]"
                  aria-expanded={accountOpen}
                >
                  <UserCircle size={17} />
                  <span>{compactName}</span>
                  <ChevronDown size={14} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-11 w-[calc(100vw-1.5rem)] max-w-60 overflow-hidden rounded-lg border border-[#ebdcd0] bg-white shadow-xl">
                    <div className="border-b border-[#f2e8e0] bg-[#fdfaf7] p-3">
                      <p className="truncate text-sm font-black text-[#1b1c1c]">{user.fullName || user.email}</p>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#ff6b00]">{user.role?.toLowerCase()}</p>
                    </div>
                    <div className="p-2">
                      {accountLinks.map(link => (
                        <Link
                          key={link.href}
                          href={platformHref(link.href)}
                          className="block rounded-md px-3 py-2.5 text-sm font-bold text-[#405046] transition hover:bg-[#fdfaf7] hover:text-[#ff6b00]"
                        >
                          {link.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        onClick={logout}
                        className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-bold text-[#7b3f3f] transition hover:bg-[#fff5f3]"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={platformHref('/login')}
                className="hidden h-9 items-center gap-1.5 rounded-md px-2 text-xs font-black text-[#405046] transition hover:bg-[#ffedd5]/30 hover:text-[#ff6b00] sm:inline-flex"
              >
                <UserCircle size={17} />
                <span>Sign in</span>
              </Link>
            )}

            {!user && (
              <Link href={platformHref('/register')} className="hidden h-9 items-center gap-1.5 rounded-md bg-[#ff6b00] px-3 text-xs font-black text-white transition hover:bg-[#e05300] xl:inline-flex">
                <UserPlus size={15} />
                {t('nav_join') || 'Join'}
              </Link>
            )}
          </div>
        </div>

        {!isDashboard && (
          <form onSubmit={handleSearch} className="border-t border-[#f0eded] px-3 py-2 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b938d]" size={16} />
              <input
                type="text"
                placeholder={t('home_search_placeholder') || 'Search markets or products...'}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-[#e0e0e0] bg-white pl-10 pr-3 text-sm font-semibold text-[#1b1c1c] outline-none"
              />
            </div>
          </form>
        )}

        {mobileMenuOpen && (
          <div className="border-t border-[#e9eeeb] bg-white px-3 py-4 shadow-lg md:hidden">
            <div className="grid gap-2">
              {visibleNavItems.map(item => {
                const NavComponent = item.absolute ? 'a' : Link;
                const active = isNavActive(item.href);
                return (
                  <NavComponent
                    key={item.href}
                    href={platformHref(item.href)}
                    className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm font-black transition ${
                      active ? 'border-[#ff6b00] bg-[#ffedd5] text-[#ff6b00]' : 'border-[#f2e8e0] bg-white text-[#405046]'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </NavComponent>
                );
              })}
            </div>
            {!isDashboard && (
              <div className="mt-4 rounded-lg border border-[#f2e8e0] bg-[#fdfaf7] p-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#ff6b00]">Market areas</p>
                <div className="grid grid-cols-2 gap-2">
                  {locationOptions.slice(0, 4).map(option => (
                    <button
                      key={option.href}
                      type="button"
                      onClick={() => routeToLocation(option.href)}
                      className="rounded-md border border-[#d2bca8] bg-white px-2 py-2 text-left text-xs font-black text-[#405046]"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {user ? (
                <>
                  <Link href={platformHref(accountHref)} className="rounded-md bg-[#ff6b00] px-3 py-3 text-center text-sm font-black text-white">Account</Link>
                  <button type="button" onClick={logout} className="rounded-md border border-[#d2bca8] px-3 py-3 text-sm font-black text-[#405046]">Sign out</button>
                </>
              ) : (
                <>
                  <Link href={platformHref('/login')} className="rounded-md border border-[#d2bca8] px-3 py-3 text-center text-sm font-black text-[#405046]">Sign in</Link>
                  <Link href={platformHref('/register')} className="rounded-md bg-[#ff6b00] px-3 py-3 text-center text-sm font-black text-white">Join RMF</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex-grow flex relative">
        {/* Dashboard Side Navigation */}
        {isDashboard && (
          <aside className="hidden w-[20rem] shrink-0 border-r border-[#ebdcd0] bg-white p-6 md:block sticky top-16 h-[calc(100vh-4rem)] z-40 overflow-y-auto">
            <div className="mb-8">
               <h2 className="text-2xl font-black text-[#a04100]">
                  {user?.role === 'ADMIN' ? 'Admin Portal' : (user?.role === 'SELLER' ? 'Marketplace Portal' : 'Navigation')}
                </h2>
               <p className="mt-1 text-sm font-medium leading-5 text-[#574e47]">Operational View</p>
            </div>
            
            <nav className="space-y-3">
              {visibleNavItems.map((item) => {
                const isActive = isNavActive(item.href);
                const NavComponent = item.absolute ? 'a' : Link;
                return (
                  <NavComponent 
                    key={item.href} 
                    href={platformHref(item.href)}
                    className={`block w-full rounded px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-[#ff6b00] text-[#351000]' 
                        : 'text-[#3f2114] hover:bg-[#ffedd5] hover:text-[#a04100]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={isActive ? 'text-[#351000]' : 'text-[#5a4136]'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                  </NavComponent>
                );
              })}
              
              <div className="mt-12 border-t border-[#ebdcd0] pt-6">
                <button 
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-sm font-bold text-[#7a3000] transition-colors hover:bg-[#ffedd5]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span>{t('nav_logout') || 'Sign Out'}</span>
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-grow flex flex-col relative overflow-x-hidden">
          {/* Search Bar for Markets Page */}
          {!isWorkstation && pathname === '/markets' && (
             <div className="h-12 bg-white border-b border-[#ebdcd0] flex items-center px-6 md:px-10">
                <div className="flex items-center gap-6 [&>span:nth-child(2)]:hidden">
                   <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ff6b00]">
                     <span className="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                     Live
                   </span>
                   <span className="text-[0.4375rem] font-black text-[#ff6b00] uppercase tracking-widest animate-pulse">● Live</span>
                   <div className="h-3 w-px bg-[#e0e0e0]"></div>
                    <form onSubmit={handleSearch} className="relative group [&>span]:hidden">
                       <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-[#414844]" size={14} />
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#1b1c1c] opacity-40 text-[0.625rem]">🔍</span>
                      <input 
                        type="text" 
                        placeholder={t('home_search_placeholder') || "Search markets & products..."} 
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                      className="w-[min(16rem,52vw)] bg-transparent border-none pl-5 text-sm font-semibold outline-none"
                      />
                   </form>
                </div>
             </div>
          )}

          <div className={`${pathname === '/' ? 'w-full min-w-0 flex-grow animate-reveal' : `rmf-container py-6 md:py-8 flex-grow animate-reveal w-full max-w-[1920px] mx-auto ${isDashboard ? 'px-4 md:px-12' : ''}`}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Global Cinematic Footer */}
      {pathname !== '/' && <Footer />}
    </div>
  );
};

export const Layout = (props: LayoutProps) => {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff6b00] border-t-transparent rounded-full"></div>
      </div>
    }>
      <LayoutContent {...props} />
    </React.Suspense>
  );
};
