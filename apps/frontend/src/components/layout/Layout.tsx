'use client';
import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/components/cart/CartContext';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface LayoutProps {
  children: ReactNode;
  marketName?: string;
}

export const Layout = ({ children, marketName }: LayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { cartCount } = useCart();
  const [globalSearch, setGlobalSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      router.push(`/markets?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  // Navigation items per role — using natural e-commerce language
  const buyerNav = [
    { label: t('nav_hub') || 'Markets', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, href: '/markets' },
    { label: t('nav_dashboard') || 'My Account', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, href: '/dashboard', auth: true },
    { label: t('nav_mandates') || 'My Orders', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, href: '/orders', auth: true },
    { label: t('nav_wallet') || 'Wallet', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, href: '/wallet', auth: true },
    { label: t('nav_wishlist') || 'Wishlist', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, href: '/wishlist', auth: true },
  ];

  const sellerNav = [
    { label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, href: '/seller/dashboard' },
    { label: 'Products', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>, href: '/seller/products' },
    { label: 'Promotions', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, href: '/seller/promotions' },
    { label: 'Earnings', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, href: '/seller/earnings' },
  ];
  
  const riderNav = [
    { label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, href: '/rider/dashboard' },
    { label: 'Deliveries', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, href: '/rider/deliveries' },
  ];

  type NavItem = { label: string; icon: React.ReactElement; href: string; auth?: boolean };

  const navItems: NavItem[] = user?.role === 'SELLER' ? sellerNav : (user?.role === 'RIDER' ? riderNav : buyerNav);
  const visibleNavItems = navItems.filter(item => !item.auth || user);
  const isWorkstation = user?.role === 'SELLER' || user?.role === 'RIDER';
  const isDashboard = pathname.startsWith('/dashboard') || 
                      pathname.startsWith('/seller') || 
                      pathname.startsWith('/rider') || 
                      pathname.startsWith('/admin') ||
                      ['/orders', '/wallet', '/wishlist'].some(p => pathname === p || pathname.startsWith(p + '/'));

  return (
    <div className="min-h-screen bg-[#F8F6F1] font-sans selection:bg-[#F59E0B] selection:text-white flex flex-col">
      {/* Main Header */}
      <header className="h-20 bg-white border-b border-[#E5E1D8] flex items-center justify-between px-10 md:px-16 sticky top-0 z-50 shadow-sm relative overflow-hidden">
        {/* Subtle Background Detail */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
           <div className="absolute top-0 right-0 w-1/3 h-full bg-[radial-gradient(circle_at_100%_0%,#F59E0B,transparent_70%)]"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-8 border-r border-[#E5E1D8] pr-8 mr-6">
          <Link href="/" className="flex flex-col group">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-serif font-black tracking-tighter text-[#121212] group-hover:text-[#F59E0B] transition-colors">RMF</span>
              <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full"></div>
            </div>
            <span className="text-[7px] font-black text-[#A34D15] uppercase tracking-[0.4em] leading-none mt-1 opacity-80">
              {user?.role === 'SELLER' ? 'Seller Hub' : (user?.role === 'RIDER' ? 'Rider Hub' : 'Marketplace')}
            </span>
          </Link>
        </div>

        {/* Navigation */}
        {!isDashboard ? (
          <nav className="relative z-10 flex-grow flex items-center gap-1 max-w-4xl">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`flex items-center gap-3 px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all relative group overflow-hidden ${
                    isActive 
                      ? 'text-[#F59E0B]' 
                      : 'text-[#121212]/60 hover:text-[#121212] hover:bg-[#F2F0EB]'
                  }`}
                >
                  <span className={`transition-transform duration-500 group-hover:scale-110 ${isActive ? 'text-[#F59E0B]' : 'text-[#121212]/20 group-hover:text-[#121212]/70'}`}>
                    {item.icon}
                  </span>
                  <span className="relative z-10">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-5 right-5 h-0.5 bg-[#F59E0B]"></div>
                  )}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="flex-grow flex items-center px-8">
             <span className="text-[9px] font-black uppercase tracking-[0.6em] text-[#121212]/40 italic">Dashboard</span>
          </div>
        )}

        {/* Right Actions */}
        <div className="relative z-10 flex items-center gap-6 border-l border-[#E5E1D8] pl-8 ml-6">
          {/* Language Selector */}
          <div className="hidden xl:flex gap-2">
            {['en', 'fr', 'kin'].map(lang => (
              <button 
                key={lang} 
                onClick={() => setLanguage(lang as any)}
                className={`w-12 h-12 border-2 flex flex-col items-center justify-center transition-all group shadow-sm ${
                  language === lang 
                    ? 'bg-[#121212] text-white border-[#121212]' 
                    : 'bg-white text-[#121212] border-[#121212] hover:bg-[#F2F0EB]'
                }`}
              >
                <span className="text-[10px] font-black tracking-widest leading-none">{lang.toUpperCase()}</span>
                <span className="text-[6px] font-black tracking-tighter uppercase opacity-60 mt-1">Lang</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-3">
              <NotificationBell />
              
              {!isWorkstation && (
                <Link href="/cart" className="w-12 h-12 border-2 border-[#121212] bg-white flex flex-col items-center justify-center hover:bg-[#121212] hover:text-white transition-all text-[#121212] relative group shadow-sm">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
                      <circle cx="8" cy="21" r="1"></circle>
                      <circle cx="19" cy="21" r="1"></circle>
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                   </svg>
                   <span className="text-[7px] font-black tracking-tighter uppercase">Cart</span>
                   {cartCount > 0 && (
                     <span className="absolute -top-2 -right-2 bg-[#F59E0B] text-white text-[9px] font-black px-2 py-0.5 border-2 border-white shadow-lg">
                       {cartCount}
                     </span>
                   )}
                </Link>
              )}
            </div>

            {user ? (
              <div 
                onClick={logout}
                className="w-12 h-12 bg-white text-[#121212] border-2 border-[#121212] flex flex-col items-center justify-center hover:bg-[#121212] hover:text-white transition-all cursor-pointer shadow-sm group"
                title="Sign Out"
              >
                <span className="text-[11px] font-black tracking-tighter leading-none">{user?.fullName ? user.fullName[0].toUpperCase() : 'U'}</span>
                <span className="text-[6px] font-black tracking-tighter uppercase opacity-60 mt-1">Out</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="w-12 h-12 border-2 border-[#121212] bg-white flex flex-col items-center justify-center hover:bg-[#121212] hover:text-white transition-all text-[#121212] shadow-sm group">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  <span className="text-[7px] font-black tracking-tighter uppercase">Login</span>
                </Link>
                <Link href="/register" className="w-12 h-12 border-2 border-[#121212] bg-[#121212] text-white flex flex-col items-center justify-center hover:bg-[#F59E0B] transition-all shadow-sm group">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  <span className="text-[7px] font-black tracking-tighter uppercase">Join</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-grow flex relative">
        {/* Dashboard Side Navigation */}
        {isDashboard && (
          <aside className="w-[260px] bg-[#121212] border-r border-white/5 flex flex-col sticky top-20 h-[calc(100vh-5rem)] z-40 overflow-y-auto">
            <div className="px-6 py-8">
               <p className="text-[8px] font-black text-[#F59E0B] uppercase tracking-[0.5em] opacity-40 mb-6">Navigation</p>
                <nav className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        className={`flex items-center gap-4 px-4 py-3.5 text-[9px] font-black uppercase tracking-[0.3em] transition-all relative group overflow-hidden ${
                          isActive 
                            ? 'text-white bg-white/5 border-l-2 border-[#F59E0B]' 
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className={`transition-transform duration-500 group-hover:scale-110 ${isActive ? 'text-[#F59E0B]' : 'text-white/20 group-hover:text-white/70'}`}>
                          {item.icon}
                        </span>
                        <span className="relative z-10">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

               <div className="mt-12 pt-6 border-t border-white/5">
                  <p className="text-[7px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Account</p>
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-4 px-4 py-3 text-[9px] font-black uppercase tracking-[0.3em] text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Sign Out</span>
                  </button>
               </div>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-grow flex flex-col relative overflow-hidden">
          {/* Search Bar for Markets Page */}
          {!isWorkstation && pathname === '/markets' && (
             <div className="h-10 bg-white border-b border-[#E5E1D8] flex items-center px-16">
                <div className="flex items-center gap-6">
                   <span className="text-[7px] font-black text-[#A34D15] uppercase tracking-widest animate-pulse">● Live</span>
                   <div className="h-3 w-px bg-[#E5E1D8]"></div>
                   <form onSubmit={handleSearch} className="relative group">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#121212] opacity-40 text-[10px]">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Search markets & products..." 
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        className="bg-transparent border-none pl-5 text-[7px] font-black uppercase tracking-widest outline-none w-64"
                      />
                   </form>
                </div>
             </div>
          )}

          <div className={`rmf-container py-8 flex-grow animate-reveal w-full max-w-[1920px] mx-auto ${isDashboard ? 'px-8 md:px-12' : ''}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t-4 border-[#121212] pt-40 pb-20 mt-auto">
        <div className="rmf-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-24 mb-40">
            <div className="space-y-12">
              <Link href="/" className="flex flex-col group w-fit">
                <span className="text-6xl font-serif font-black tracking-tighter text-[#121212] group-hover:text-[#F59E0B] transition-colors">RMF</span>
                <span className="text-[11px] font-black text-[#F59E0B] uppercase tracking-[0.6em] mt-4">Marketplace</span>
              </Link>
              <p className="text-sm text-[#6B665E] leading-relaxed italic max-w-xs">
                Rwanda&apos;s trusted online marketplace — connecting local markets, sellers, and buyers with fast home delivery across Kigali and beyond.
              </p>
            </div>
            <div className="space-y-10">
              <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.5em]">Quick Links</p>
              <div className="flex flex-col gap-6">
                <Link href="/privacy" className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest hover:text-[#F59E0B] transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest hover:text-[#F59E0B] transition-colors">Terms of Service</Link>
                <Link href="/contact" className="text-[10px] font-bold text-[#6B665E] uppercase tracking-widest hover:text-[#F59E0B] transition-colors">Contact Us</Link>
              </div>
            </div>
            <div className="space-y-10">
               <p className="text-[11px] font-black text-[#121212] uppercase tracking-[0.5em]">Platform Status</p>
               <div className="p-8 border-2 border-[#F0EDE4] bg-[#F8F6F1]">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#121212]">All Systems Online</span>
                  </div>
                  <p className="text-[9px] text-[#6B665E] italic">All markets and delivery services are currently active and accepting orders.</p>
               </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 pt-20 border-t border-[#F0EDE4]">
            <p className="text-[9px] font-black text-[#A34D15] uppercase tracking-[0.4em]">© 2026 Rwanda Market Facilitator</p>
            <div className="flex gap-10 opacity-30 grayscale">
               <span className="text-xs">🇷🇼</span>
               <span className="text-xs">Made in Rwanda</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
